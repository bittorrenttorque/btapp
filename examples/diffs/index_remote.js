$(function() {
	window.btappview = new window.BtappView({'model':new Btapp({'username':'username','password':'password'}), 'el':'body'});
	window.btappview.render();
});