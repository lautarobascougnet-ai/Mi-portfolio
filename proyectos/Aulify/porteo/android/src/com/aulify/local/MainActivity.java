package com.aulify.local;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

// App local: carga la web existente mediante HTTPS, sin duplicar lógica de negocio.
public class MainActivity extends Activity {
	private WebView web;
	private LinearLayout errorPanel;
	private ValueCallback<Uri[]> files;
	private String startUrl;

	@Override public void onCreate(Bundle state) {
		super.onCreate(state);
		startUrl = getString(R.string.aulify_url);
		LinearLayout root = new LinearLayout(this);
		root.setOrientation(LinearLayout.VERTICAL);
		root.setBackgroundColor(Color.rgb(98, 103, 128));
		root.setOnApplyWindowInsetsListener((view, insets) -> {
			view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
				insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
			return insets.consumeSystemWindowInsets();
		});
		errorPanel = new LinearLayout(this);
		errorPanel.setOrientation(LinearLayout.VERTICAL);
		errorPanel.setPadding(32, 32, 32, 32);
		TextView message = new TextView(this);
		message.setTextColor(Color.WHITE);
		message.setText("No se pudo abrir Aulify. Conecta el teléfono al mismo router que la PC y comprueba que Apache, MySQL y porteo estén iniciados.");
		errorPanel.addView(message);
		Button retry = new Button(this);
		retry.setText("Volver a intentar");
		retry.setOnClickListener(view -> { errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(startUrl); });
		errorPanel.addView(retry);
		errorPanel.setVisibility(View.GONE);
		root.addView(errorPanel);
		web = new WebView(this);
		root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
		setContentView(root);
		WebSettings settings = web.getSettings();
		settings.setJavaScriptEnabled(true);
		settings.setUserAgentString(settings.getUserAgentString() + " AulifyApp/1.1");
		settings.setDomStorageEnabled(true);
		settings.setAllowFileAccess(false);
		settings.setAllowContentAccess(true); // Selección de fotos mediante el selector de Android.
		settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
		CookieManager.getInstance().setAcceptCookie(true);
		CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
		web.setWebViewClient(new WebViewClient() {
			@Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
				if (!request.isForMainFrame()) return true;
				Uri uri = request.getUrl();
				Uri origin = Uri.parse(startUrl);
				if ("https".equals(uri.getScheme()) && origin.getHost().equals(uri.getHost()) && origin.getPort() == uri.getPort()) return false;
				if ("https".equals(uri.getScheme())) {
					try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
					catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "No hay navegador disponible", Toast.LENGTH_SHORT).show(); }
				}
				return true;
			}
			@Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
				if (request.isForMainFrame()) showConnectionError();
			}
			@Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
				if (request.isForMainFrame() && response.getStatusCode() >= 500) showConnectionError();
			}
			// Los errores SSL conservan el comportamiento seguro: cancelar, nunca ignorarlos.
		});
		web.setWebChromeClient(new WebChromeClient() {
			@Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
				if (files != null) files.onReceiveValue(null);
				files = callback;
				try { startActivityForResult(params.createIntent(), 10); }
				catch (ActivityNotFoundException error) { files.onReceiveValue(null); files = null; }
				return true;
			}
		});
		if (!openVerification(getIntent())) web.loadUrl(startUrl);
	}
	// Solo se acepta un ticket opaco. Nunca se carga una URL enviada por otra app.
	private boolean openVerification(Intent intent) {
		Uri uri = intent == null ? null : intent.getData();
		if (uri == null || !"aulify".equals(uri.getScheme()) || !"verification".equals(uri.getHost())) return false;
		String ticket = uri.getQueryParameter("ticket");
		if (ticket == null || !ticket.matches("[a-f0-9]{64}")) return false;
		errorPanel.setVisibility(View.GONE);
		web.setVisibility(View.VISIBLE);
		web.loadUrl(startUrl.substring(0, startUrl.lastIndexOf('/') + 1) + "verificacion.html#ticket=" + ticket);
		return true;
	}
	@Override protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
		openVerification(intent);
	}
	private void showConnectionError() {
		web.setVisibility(View.GONE);
		errorPanel.setVisibility(View.VISIBLE);
	}
	@Override protected void onActivityResult(int request, int result, Intent data) {
		super.onActivityResult(request, result, data);
		if (request == 10 && files != null) {
			files.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
			files = null;
		}
	}
	@Override public void onBackPressed() {
		if (web.canGoBack()) web.goBack(); else super.onBackPressed();
	}
	@Override protected void onPause() {
		CookieManager.getInstance().flush();
		web.onPause();
		super.onPause();
	}
	@Override protected void onResume() {
		super.onResume();
		if (web != null) {
			web.onResume();
			web.evaluateJavascript("window.dispatchEvent(new Event('aulify:resume'))", null);
		}
	}
	@Override protected void onDestroy() {
		if (files != null) files.onReceiveValue(null);
		web.destroy();
		super.onDestroy();
	}
}
