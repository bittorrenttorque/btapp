"use strict";
module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    files: [
      'plugin.btapp.js',
      'pairing.btapp.js',
      'client.btapp.js',
      'btapp.js'
    ],
    meta: {
      version: '0.2.0',
      banner: '// Btapp.js <%= meta.version %>\n\n' +
              '// (c) 2012 Patrick Williams, BitTorrent Inc.\n' +
              '// Btapp may be freely distributed under the MIT license.\n' +
              '// For all details and documentation:\n' +
              '// http://btappjs.com\n' 
    },
    lint: {
      files: ['<config:files>','spec/**/*.js']
    },
    watch: {
      files: ['<config:jasmine.specs>','*.js'],
      tasks: 'jasmine'
    },
    jasmine : {
      src : [
        'components/jquery/jquery.js', 
        'components/underscore/underscore.js', 
        'components/backbone/backbone.js', 
        'components/jStorage/jstorage.js', 
        'btapp.min.js'
      ],
      specs : ['spec/**/*.js']
    },
    concat: {
      dist: {
        src: ['<config:files>'],
        dest: 'btapp.concat.js'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
        dest: 'btapp.min.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: true,
        boss: true,
        eqnull: true,
        node: true,
        es5: true
      },
      globals: {
        $: false,
        document: false,
        window: false,
        navigator: false,
        jasmine : false,
        describe : false,
        beforeEach : false,
        waitsFor: false,
        runs: false,
        expect : false,
        it : false,
        spyOn : false,
        jQuery: true,
        _: true,
        Btapp: true,
        TorrentClient: true,
        LocalTorrentClient: true,
        FalconTorrentClient: true,
        BtappBase: true,
        BtappCollection: true,
        BtappModel: true,
        PluginManager: true,
        PluginManagerView: true,
        PluginPairing: true,
        JQueryPairing: true,
        Pairing: true,
        PairingView: true,
        Backbone: true,
        JSLoad: true,
        falcon: true,
        ActiveXObject: true
      }
    }
  });

  grunt.loadNpmTasks('grunt-jasmine-runner');
  grunt.registerTask('default', 'lint concat min jasmine');

};