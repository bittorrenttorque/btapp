# Backbone.Btapp.js

Backbone.Btapp.js provides access to a browser plugin version of uTorrent/BitTorrent via a tree of Backbone Models and Collections. The intent of this project is to allow access to the extensive functionality of a torrent client, from web apps that are simply Backbone Views. Backbone.Btapp.js takes responsibility for getting the plugin installed as well, so you're free to assume that its available. In addition to the local torrent client, you can also easily access a torrent client anywhere else in the world (assume you either configured it originally or have access to that client's username/password).

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

## Utilities

The following utilities are designed to get you started working with the library. Part of getting started includes installing the same plugin that your users will need to install in order to use your app. As all these utilities are themselves apps that use this library, clicking on any of these will take you through the process (You only need to install once, regardless of which browsers you use). If you're unfamiliar with all the functionality that the torrent client has to offer, ApiViewer is probably a good first stop. 

### ApiViewer
### BtappListener
### BtappPlugin
### RemoteSetup

## Examples
### Nud.gs
### Gibe
### Flix