backbone.btapp.js
===================
===================
__backbone.btapp.js__ is an extension built on Backbone.js that keeps an up-to-date representation of your uTorrent client's state/torrents/etc. It runs in your browser and can connect to an arbitrary number of clients on your local machine, or remotely through uTorrent/BitTorrent's remote feature.

__Dependencies__:  
[jquery](http://jquery.com/ "jquery")  
[jquery json](http://code.google.com/p/jquery-json/ "jquery json")  
[underscore](http://documentcloud.github.com/underscore/ "underscore")  
[backbone](http://documentcloud.github.com/backbone/ "backbone")  
  
  
plugin.btapp.js  
===================
__plugin.btapp.js__ is responsible for ensuring that a client is run on your local machine. It provides an install path for the browser plugins that will in turn install/run uTorrent/BitTorrent as needed. Do not include if your app doesn't require a client running on the local machine. Keep in mind that you don't need the dependencies. You're more than welcome to style the dialog to your taste. The goal is simply to get the client on the local machine so you can get back to programming, assuming its there.

__Dependencies:__  
[bootstrap-modal](http://twitter.github.com/bootstrap/javascript.html#modal "bootstrap modal")  
[bootstrap css](http://twitter.github.com/bootstrap/1.4.0/bootstrap.min.css "bootstrap css")  

	
Documentation and annotated source code is available at:
http://pwmckenna.com/projects/btapp/