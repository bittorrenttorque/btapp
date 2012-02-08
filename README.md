<link rel="icon" href="docs/images/favicon.ico">

<img id="logo" src="http://www.pwmckenna.com/img/bittorrent_medium.png" />

# Backbone.Btapp.js
Backbone.Btapp.js provides access to a browser plugin version of uTorrent/BitTorrent via a tree of Backbone Models and Collections. The intent of this project is to allow access to the extensive functionality of a torrent client, from web apps that are as simple as a single Backbone View. Backbone.Btapp.js takes responsibility for getting the plugin installed as well, so you're free to assume that its available. In addition to the local torrent client, you can also easily access a torrent client anywhere else in the world (assume you either configured it originally or have access to that client's username/password).

The project is [hosted on GitHub](https://github.com/pwmckenna/btapp/ "github"), and the [annotated source code](http://pwmckenna.github.com/btapp/docs/backbone.btapp.html "source") is available. An [example application](http://pwmckenna.github.com/nud.gs/ "see it run!") with [annotated source](http://pwmckenna.github.com/nud.gs/docs/nudgs.html "annotation") is also available through [GitHub](http://github.com/pwmckenna/nud.gs/ "source").

## Downloads & Dependencies
[Nightly Version (0.1)](https://raw.github.com/pwmckenna/btapp/master/backbone.btapp.js "backbone.btapp.js") 28kb, Full source, lots of comments

Backbone.Btapp.js has hard dependencies of the following:  
[jquery.js](http://cdnjs.cloudflare.com/ajax/libs/jquery/1.7.1/jquery.min.js "jquery")  
[jquery.json.js](http://jquery-json.googlecode.com/files/jquery.json-2.3.min.js "json")  
[underscore.js](http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.2.2/underscore-min.js "underscore")  
[backbone.js](http://cdnjs.cloudflare.com/ajax/libs/backbone.js/0.5.3/backbone-min.js "backbone")  

## Introduction

Backbone.Btapp.js builds off of Backbone.js to provide easy access to a torrent client, either on the local machine or a remote machine. The documentation, annotated source, and examples are designed to be as similar to the getting started experience of Backbone as possible. However, the functionality provided through these backbone models and collections is quite extensive and powerful, so its probably worth a look at the [Api Browser](http://pwmckenna.github.com/btapp_api_viewer/ "api") to get an idea of what is possible. Many of the attributes and functions that are made available through this library have examples to give you some idea of what they can be used for. 

## Getting Started

The first step is simply to create a new Btapp object. This will provide you with a javascript representation of a torrent client. You can use these to connect to either your local machine's client or a remote machine (the possibilities are less obvious with remote connections, but this is in my opinion the most powerful and truly unique part of this library)

#### Local Connection
To connect to the plugin client on your local machine...
<div class="run" title="Run"></div>
```javascript
local = new Btapp({});
```

#### Remote Connection 
(referred to occasionally as the falcon proxy)  
Lets setup the local machine with some proxy credentials and see if we can't connect to it via the falcon proxy. This proxy Btapp object will point to the same torrent client as your original Btapp object (Though you might notice the update times are much longer as it gets routed through a proxy instead of over localhost). You can have unlimited objects all representing the same torrent client (be careful to not step on each others toes though).

<div class="run" title="Run"></div>
```javascript
username = prompt("Please enter your name","Harry Potter");
password = prompt("Please enter your password","Abracadabra");

local.bt.connect_remote(
    function() { }, 
	username,
	password
);
```

Now that we're connected to the falcon proxy we can connect to your current local machine by executing the following code from any computer in the world!

<div class="run" title="Run"></div>
```javascript
remote = new Btapp({  
    'username':username,  
	'password':password
});
```

#### Things to note:

Lets take a moment to look at that function call. First off, its important to note that all functions provided by the torrent client are in the bt member of each object. If you look at the [api viewer](http://pwmckenna.github.com/btapp_api_viewer/ "api"), you'll notice that this call doesn't quite match the signature that is displayed there. Which brings us to a pretty important aspect of this library...
  
Everything is asynchronous! So you must provide a callback argument as the first argument for every bt (those in the bt member) function call, then continue with the documented arguments. The callback receives a data blob that varies depending on the function.


## Utilities

The following utilities are designed to get you started working with the library. Part of getting started includes installing the same plugin that your users will need to install in order to use your app. As all these utilities are themselves apps that use this library, clicking on any of these will take you through the process (You only need to install once, regardless of which browsers you use). If you're unfamiliar with all the functionality that the torrent client has to offer, ApiViewer is probably a good first stop. 

### Api Viewer
### Btapp Listener
### Btapp Plugin
### Remote Setup

## Examples
### Nud.gs
### Gibe
### Flix