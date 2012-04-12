<link rel="icon" href="docs/images/favicon.ico">

<img id="logo" src="http://www.pwmckenna.com/img/bittorrent_medium.png" />

# Btapp.js
Btapp.js provides access to a browser plugin version of uTorrent/BitTorrent via a tree of [Backbone Models and Collections](http://documentcloud.github.com/backbone/ "backbone"). The intent of this project is to allow access to the extensive functionality of a torrent client, from web apps that are as simple as a single Backbone View. Btapp.js takes responsibility for getting the plugin installed as well, so you're free to assume that its available. In addition to the local torrent client, you can also easily access a torrent client anywhere else in the world (assume you either configured it originally or have access to that client's username/password).

The project is [hosted on GitHub](https://github.com/pwmckenna/btapp/ "github"), and the [annotated source code](http://pwmckenna.github.com/btapp/docs/btapp.html "source") is available. An [example application](http://pwmckenna.github.com/nud.gs/ "see it run!") with [annotated source](http://pwmckenna.github.com/nud.gs/docs/nudgs.html "annotation") is also available through [GitHub](http://github.com/pwmckenna/nud.gs/ "source").

#### Downloads and Dependencies
[Github Bleeding Edge Version (4.2.1)](https://raw.github.com/pwmckenna/btapp/master/btapp.js "btapp.js") 20kb, Full source, lots of comments  
[Development Version (4.2.1)](http://apps.bittorrent.com/torque/btapp/btapp.js "btapp.js") 20kb, Full source, lots of comments  
  
A Production version is on the way. It will be minified and include the the *.btapp.js dependencies.

Btapp.js's has all of Backbone's dependencies, but also requires json2...the *.btapp.js files contain functionality that is situation specific, and will be pulled in dynamically when needed by btapp.js, or you can include them yourself for the speed boost (they will be included by default in production versions of btapp.js).
  
[backbone.js v0.9.1](http://cdnjs.cloudflare.com/ajax/libs/backbone.js/0.9.1/backbone-min.js "backbone") ([documentation](http://documentcloud.github.com/backbone/ "backbone"))  
[json2.js](http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js "json2") ([documentation](http://www.json.org/js.html "json2"))  
[client.btapp.js](http://apps.bittorrent.com/torque/btapp/client.btapp.js "client.btapp.js")  
[pairing.btapp.js](http://apps.bittorrent.com/torque/btapp/pairing.btapp.js "pairing.btapp.js")  
[plugin.btapp.js](http://apps.bittorrent.com/torque/btapp/plugin.btapp.js "plugin.btapp.js")  
  

## Introduction

Btapp.js builds off of Backbone.js to provide easy access to a torrent client, either on the local machine or a remote machine. The documentation, annotated source, and examples are designed to be as similar to the getting started experience of Backbone as possible. However, the functionality provided through these backbone models and collections is quite extensive and powerful, so its probably worth a look at the [Api Browser](http://pwmckenna.github.com/btapp_api_viewer/ "api") to get an idea of what is possible. Many of the attributes and functions that are made available through this library have examples to give you some idea of what they can be used for. 

## Getting Started

######Include btapp.js in your html file
```  
<script src="http://apps.bittorrent.com/torque/btapp/btapp.js" />  
```  

######Create a Btapp object and connect it to your local machine
```javascript
var btapp = new Btapp;  
btapp.connect();
```

*this code was executed when the page was loaded to ensure that the examples below work even if you forget about this...*

#### Local Machine vs Remote Connection  
When you call *connect*, by default you're connecting to your local torque client. However, if you provide a username and password, an attempt will be made to connect through BitTorrent's remote proxy. Your client must connect to remote before this option is available to you.
  
<div class="run" title="Run"></div>
```javascript
username = prompt("Please enter your name","Harry Potter");
password = prompt("Please enter your password","Abracadabra");

btapp.bt.connect_remote(
    function() { }, 
	username,
	password
);
```

Now that we're connected to the falcon proxy we can connect to your current local machine by executing the following code from any computer in the world!

<div class="run" title="Run"></div>
```javascript
remote_btapp = new Btapp;
remote_btapp.connect({  
    'username':username,  
	'password':password
});
```

### Listening for state changes
I'm about to show you how to add and remove data, and here is where the dependency on Backbone makes the most sense. The data in the Btapp object is updates as the state of the torrent client changes, so to listen for objects being added to your torrent client, you can bind add listeners to the corresponding Backbone Models and Collections.  
  
For instance, to show an alert each time a torrent is added to the client, just bind to the torrent list...__Note:__ We're not guaranteed the list of torrents will be there either...so lets listen for that as well.
<div class="run" title="Run"></div>
```javascript
function listen_for_torrents() {
	if(btapp.get('torrent')) {
		btapp.get('torrent').bind('add', function() {
			alert('torrent added!');
		});
	} else {
		btapp.bind('add:torrent', listen_for_torrents);
	}
}
listen_for_torrents.call(this);
```

If this seems a bit messy for you, there is an addition bit of javascript call the [Btapp Listener](#section-4-2 "listener") that you can include that will make these bind add chains much easier to deal with.

### Adding torrents via urls/magnet links
Easy-peasy
<div class="run" title="Run"></div>
```javascript
var url = 'http://www.clearbits.net/get/1766-the-tunnel.torrent';
btapp.get('add').bt.torrent(function() {}, url);
```
And by easy-peasy I mean, wtf?!? So, the base object has an attribute called *add*, which is an object that stores all the functionality for adding stuff to the client (torrents, rss_feeds, rss_filters, etc)...because *add* is a torrent client object, the functions are in the *bt* member. the *torrent* function of the *add* member adds a torrent to the client. Phew. 

If you find yourself down a dark alley needing rss feeds, its almost the same to add one of those.
<div class="run" title="Run"></div>
```javascript
var url = 'http://www.clearbits.net/feeds/cat/short-form-video.rss';
btapp.get('add').bt.rss_feed(function() {}, url);
```


Ok, adding existing content is pretty nice, but your users might want to share their own content...

### Creating torrents
<div class="run" title="Run"></div>
```javascript
btapp.bt.browseforfiles(function () {}, function(files) {
	_.each(files, function(value, key) {
			btapp.bt.create(
				function(ret) {
					alert('called create for ' + value);
				}, 
				'', 
				[value], 
				function(hash) {
					alert('torrent created for ' + value);
				}
			);
	});
});
```
__Warning__: this will launch a file browser on the machine that the client is running on...so if you're connected via falcon you won't be able to see the dialog pop up (but someone might get an unexpected surprise!)

### Deleting torrents
The types that bubble up from the client are either Backbone Collections or Models depending on if they are collections of other torrent client types or not...In the case of the list of torrents, its created as a Collection, which has all those convenient underscore functions available. Yippie!
<div class="run" title="Run"></div>
```javascript
	btapp.get('torrent').each(function(torrent) {
		torrent.bt.remove();
	});
```

## General Concepts

### Btapp arguments
Todo
### Custom events
Todo
### Filters (*alias* Queries)

Todo
### Underlying RESTless API
Todo

## Utilities

The following utilities are designed to get you started working with the library. Part of getting started includes installing the same plugin that your users will need to install in order to use your app (Provided you didn't go through this process when playing with the demo code above). As all these utilities are themselves apps that use this library, clicking on any of these will take you through the process (You only need to install once, regardless of which browsers you use). If you're unfamiliar with all the functionality that the torrent client has to offer, the [api viewer](http://pwmckenna.github.com/btapp_api_viewer/ "api") is probably a good first stop. 

### Api Viewer

The api viewer is a one stop shop for examining the data coming from your torrent client in real time. It is itself a web app that uses btapp.js, so the [annotated source](http://pwmckenna.github.com/btapp_api_viewer/docs/index.html "annotated source") may be useful to skim through as well. It just creates a backbone view for each bit of info bubbled up from the torrent client.

<a href="http://pwmckenna.github.com/btapp_api_viewer/"><img src="http://pwmckenna.com/img/api_viewer.png"></img></a>
This snapshot was taken while also using the Nud.gs app, which uses labels to categorize its torrents...If you're curious about the dragon file, [check it out here](http://pwmckenna.com/img/dragon.jpg "dragon!")

### Btapp Listener

The Btapp Listener is designed to allow you to listen for the additions of models at any level of the data tree much the same way jQuery uses *delegate* to bind event handlers to DOM elements that don't yet exist.

For instance, to list the name of all the files in all torrents you need to write code similar to the following...

<div class="run" title="Run"></div>
```javascript
var torrents = btapp.get('torrent');
```

## Examples
### Nud.gs
### Gibe

##Testing
Btapp.js uses [jasmine](https://github.com/pivotal/jasmine "jasmine") for unit/functional testing. You can run them yourself at: 

[http://pwmckenna.github.com/btapp/tests/SpecRunner.html](http://pwmckenna.github.com/btapp/tests/SpecRunner.html)
