# Btapp.js
Btapp.js provides access to a browser plugin version of uTorrent/BitTorrent via a tree of [Backbone Models and Collections](http://documentcloud.github.com/backbone/ "backbone"). The intent of this project is to allow access to the extensive functionality of a torrent client, from web apps that are as simple as a single Backbone View. Btapp.js takes responsibility for getting the plugin installed as well, so you're free to assume that its available. In addition to the local torrent client, you can also easily access a torrent client anywhere else in the world (assume you either configured it originally or have access to that client's username/password).

#### Downloads and Dependencies
[btapp.js](https://raw.github.com/bittorrenttorque/btapp/master/btapp.js "btapp.js")  
[client.btapp.js](https://raw.github.com/bittorrenttorque/btapp/master/client.btapp.js "client.btapp.js")  
[plugin.btapp.js](https://raw.github.com/bittorrenttorque/btapp/master/plugin.btapp.js "plugin.btapp.js")  
[pairing.btapp.js](https://raw.github.com/bittorrenttorque/btapp/master/pairing.btapp.js "pairing.btapp.js")  

Btapp.js's has all of Backbone's dependencies, but also requires json2...the *.btapp.js files contain functionality that is situation specific, and will be pulled in dynamically when needed by btapp.js, or you can include them yourself for the speed boost.
  
[jquery 1.7.2](http://code.jquery.com/jquery-1.7.2.min.js "jquery")  
[json2.js](http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js "json2")  
[underscore.js 1.3.3](http://underscorejs.org/underscore-min.js "underscore")  
[backbone.js v0.9.2](http://backbonejs.org/backbone-min.js "backbone")  
[jStorage.js](https://github.com/andris9/jStorage "jStorage")  

## Introduction

Btapp.js builds off of Backbone.js to provide easy access to a torrent client, either on the local machine or a remote machine. The documentation and examples are designed to be as similar to the getting started experience of Backbone as possible. However, the functionality provided through these backbone models and collections is quite extensive and powerful, so its probably worth a look at the [Api Visualizer](http://bittorrenttorque.github.com/visualizer/ "api") to get an idea of what is possible. Many of the attributes and functions that are made available through this library have examples to give you some idea of what they can be used for. 

## Getting Started
######Fork the [btapp project template](https://github.com/bittorrenttorque/template "template") and just start coding
#####OR
######Include btapp.js+ in your html file
```  
<script src="http://code.jquery.com/jquery-1.7.2.min.js"></script>  
<script src="http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js"></script>  
<script src="http://underscorejs.org/underscore-min.js"></script>  
<script src="http://backbonejs.org/backbone-min.js"></script>  
<script src="https://raw.github.com/andris9/jStorage/master/jstorage.js"></script>  

<script src="http://torque.bittorrent.com/btapp/btapp.js"></script>  
<script src="http://torque.bittorrent.com/btapp/client.btapp.js"></script>  
<script src="http://torque.bittorrent.com/btapp/plugin.btapp.js"></script>  
<script src="http://torque.bittorrent.com/btapp/pairing.btapp.js"></script>  

<!-- Backbrace was developed specifically to help with Backbone structures arranged like ours -->
<script src="https://raw.github.com/bittorrenttorque/backbrace/master/backbrace.js"></script>
```  

#####Ready?
######Create a Btapp object and connect it to your local machine
```javascript
var btapp = new Btapp();  
btapp.connect();  
```

At this point you can open your browser console and start playing with the *btapp* object. If you'd like a cleaner way to explore the api take a look at the [Api Visualizer](http://bittorrenttorque.github.com/visualizer/ "api").

## Concepts
#### Torrents
To iterate over your current torrents:
```javascript
btapp.on('add:torrent', function(torrent_list) {
  torrent_list.each(function(torrent) { 
    console.log(torrent.get('properties').get('name'));
  });
});
```
To add a torrent:
```javascript
btapp.on('add:add', function(add) {
  add.torrent('http://featuredcontent.utorrent.com/torrents/Kumare-BitTorrent.torrent');
});
```
#### Streaming
#### Remote
This utilizes event callbacks for the Torque RPC functions
```javascript
btapp.on('add:bt:connect_remote', function() {
  btapp.connect_remote('patrick', 'password');
});
```
Once you've connected that machine to the BitTorrent remote proxy, that computer is accessible from anywhere with those credentials.
For example, to connect from elsewhere:
```javascript
remote = new Btapp();
remote.connect({
  username: 'patrick',
  password: 'password'
});
```
You can then continue to use that object the same way as the Btapp instance that is connected to your local machine.

#### Stash
#### Settings
#### Permissions (Pending)
#### Devices (Proposed)
#### File Association (Proposed)
#### Anti-Virus (Proposed)
#### Folder Listener (Proposed)
#### Transcoding (Proposed)