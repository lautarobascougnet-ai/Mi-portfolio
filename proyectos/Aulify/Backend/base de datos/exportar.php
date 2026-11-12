<?php

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este exportador solo se puede ejecutar desde la consola.\n");
}

if ($argc !== 2) {
    fwrite(STDERR, "Uso: php exportar.php <ruta-del-archivo.sql>\n");
    exit(1);
}

$outputPath = $argv[1];
$output = false;
$createdOutput = false;

function writeSql($output, $sql)
{
    if (fwrite($output, $sql) === false) {
        throw new RuntimeException('No se pudo escribir el archivo SQL.');
    }
}

function quoteIdentifier($identifier)
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function exportForeignKeyName($tableName, $constraintName)
{
    $hash = substr(hash('sha256', $tableName . "\0" . $constraintName), 0, 16);
    $prefix = substr('fk_' . $tableName . '_' . $constraintName, 0, 43);

    return $prefix . '_' . $hash;
}

try {
    $output = @fopen($outputPath, 'xb');
    if ($output === false) {
        throw new RuntimeException(
            'No se pudo crear el archivo. Verifica la ruta y que el archivo no exista.'
        );
    }
    $createdOutput = true;

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    require __DIR__ . '/conexion.php';

    $databaseResult = $conexion->query('SELECT DATABASE()');
    $databaseName = $databaseResult->fetch_row()[0];
    $databaseResult->free();

    writeSql($output, "-- Exportación de la base de datos {$databaseName}\n");
    writeSql($output, "SET NAMES utf8mb4;\n");
    writeSql($output, "SET FOREIGN_KEY_CHECKS=0;\n\n");

    $tablesResult = $conexion->query('SHOW FULL TABLES');
    $tables = array();
    while ($table = $tablesResult->fetch_row()) {
        if ($table[1] === 'BASE TABLE') {
            $tables[] = $table[0];
        }
    }
    $tablesResult->free();

    foreach ($tables as $tableName) {
        $quotedTable = quoteIdentifier($tableName);
        $createResult = $conexion->query('SHOW CREATE TABLE ' . $quotedTable);
        $createRow = $createResult->fetch_row();
        $createResult->free();

        writeSql($output, '-- Tabla: ' . $tableName . "\n");
        writeSql($output, 'DROP TABLE IF EXISTS ' . $quotedTable . ";\n");
        writeSql($output, $createRow[1] . ";\n\n");

        $rowsResult = $conexion->query(
            'SELECT * FROM ' . $quotedTable,
            MYSQLI_USE_RESULT
        );
        $fields = $rowsResult->fetch_fields();
        $columns = array();
        foreach ($fields as $field) {
            $columns[] = quoteIdentifier($field->name);
        }

        $prefix = 'INSERT INTO ' . $quotedTable . ' (' . implode(', ', $columns) . ') VALUES ';
        $batch = array();
        while ($row = $rowsResult->fetch_row()) {
            $values = array();
            foreach ($row as $index => $value) {
                if ($value === null) {
                    $values[] = 'NULL';
                } elseif (($fields[$index]->flags & MYSQLI_BINARY_FLAG) !== 0) {
                    $values[] = '0x' . bin2hex($value);
                } else {
                    $values[] = "'" . $conexion->real_escape_string($value) . "'";
                }
            }

            $batch[] = '(' . implode(', ', $values) . ')';
            if (count($batch) === 100) {
                writeSql($output, $prefix . implode(",\n", $batch) . ";\n");
                $batch = array();
            }
        }

        if (count($batch) > 0) {
            writeSql($output, $prefix . implode(",\n", $batch) . ";\n");
        }

        $rowsResult->free();
        writeSql($output, "\n");
    }

    $foreignKeysQuery = $conexion->prepare(
        'SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, '
        . 'k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, '
        . 'r.UPDATE_RULE, r.DELETE_RULE '
        . 'FROM information_schema.KEY_COLUMN_USAGE AS k '
        . 'JOIN information_schema.REFERENTIAL_CONSTRAINTS AS r '
        . 'ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA '
        . 'AND r.TABLE_NAME = k.TABLE_NAME '
        . 'AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME '
        . 'WHERE k.CONSTRAINT_SCHEMA = ? '
        . 'AND k.REFERENCED_TABLE_NAME IS NOT NULL '
        . 'ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION'
    );
    $foreignKeysQuery->bind_param('s', $databaseName);
    $foreignKeysQuery->execute();
    $foreignKeysResult = $foreignKeysQuery->get_result();
    $foreignKeys = array();

    while ($foreignKey = $foreignKeysResult->fetch_assoc()) {
        $key = $foreignKey['TABLE_NAME'] . "\0" . $foreignKey['CONSTRAINT_NAME'];
        if (!isset($foreignKeys[$key])) {
            $foreignKeys[$key] = array(
                'table' => $foreignKey['TABLE_NAME'],
                'name' => $foreignKey['CONSTRAINT_NAME'],
                'referenced_table' => $foreignKey['REFERENCED_TABLE_NAME'],
                'update_rule' => $foreignKey['UPDATE_RULE'],
                'delete_rule' => $foreignKey['DELETE_RULE'],
                'columns' => array(),
                'referenced_columns' => array(),
            );
        }

        $foreignKeys[$key]['columns'][] = $foreignKey['COLUMN_NAME'];
        $foreignKeys[$key]['referenced_columns'][] = $foreignKey['REFERENCED_COLUMN_NAME'];
    }
    $foreignKeysResult->free();
    $foreignKeysQuery->close();

    if (count($foreignKeys) > 0) {
        writeSql($output, "-- Claves foráneas (se agregan al final para respetar las dependencias)\n");
    }

    foreach ($foreignKeys as $foreignKey) {
        $columns = array_map('quoteIdentifier', $foreignKey['columns']);
        $referencedColumns = array_map('quoteIdentifier', $foreignKey['referenced_columns']);
        $sql = 'ALTER TABLE ' . quoteIdentifier($foreignKey['table'])
            . ' ADD CONSTRAINT '
            . quoteIdentifier(exportForeignKeyName($foreignKey['table'], $foreignKey['name']))
            . ' FOREIGN KEY (' . implode(', ', $columns) . ')'
            . ' REFERENCES ' . quoteIdentifier($foreignKey['referenced_table'])
            . ' (' . implode(', ', $referencedColumns) . ')'
            . ' ON DELETE ' . $foreignKey['delete_rule']
            . ' ON UPDATE ' . $foreignKey['update_rule'] . ";\n";
        writeSql($output, $sql);
    }

    writeSql($output, "SET FOREIGN_KEY_CHECKS=1;\n");
    if (!fclose($output)) {
        throw new RuntimeException('No se pudo cerrar correctamente el archivo SQL.');
    }
    $output = false;

    echo 'Exportación completada: ' . $outputPath . PHP_EOL;
    echo 'Tablas exportadas: ' . count($tables) . PHP_EOL;
} catch (Throwable $error) {
    if (is_resource($output)) {
        fclose($output);
    }
    if ($createdOutput && file_exists($outputPath)) {
        unlink($outputPath);
    }
    fwrite(STDERR, 'Error al exportar la base de datos: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
