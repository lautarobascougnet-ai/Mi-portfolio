// Empaqueta el módulo browser de qrcode ya instalado. No usa servicios de QR externos.
const fs = require('node:fs');
const path = require('node:path');
const modules = [];
const seen = new Map();
function collect(filename) {
	if (seen.has(filename)) return seen.get(filename);
	const id = modules.length;
	seen.set(filename, id);
	modules.push('');
	const source = fs.readFileSync(filename, 'utf8').replace(/require\(['"]([^'"]+)['"]\)/g, (_, name) => {
		const dependency = require.resolve(name, { paths: [path.dirname(filename)] });
		if (!path.isAbsolute(dependency)) throw new Error('Dependencia no apta para navegador: ' + name);
		return 'load(' + collect(dependency) + ')';
	});
	modules[id] = 'function(module,exports,load){\n' + source + '\n}';
	return id;
}
const entry = collect(require.resolve('qrcode/lib/browser.js'));
const root = path.resolve(__dirname, '../..');
const license = fs.readFileSync(require.resolve('qrcode/license'), 'utf8');
const dependencyLicense = fs.readFileSync(require.resolve('dijkstrajs/LICENSE.md'), 'utf8');
fs.mkdirSync(path.join(root, 'Frontend/js/vendor'), { recursive: true });
fs.writeFileSync(path.join(root, 'Frontend/js/vendor/qrcode.js'),
	'/*! qrcode 1.5.4 - MIT\n' + license + '\n\ndijkstrajs - MIT\n' + dependencyLicense + '\n*/\n' +
	'(function(){const modules=[' + modules.join(',\n') + '];const cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports,load);return module.exports;}window.AulifyQR=load(' + entry + ');})();\n');
console.log('QR local generado. ' + modules.length + ' módulos.');
