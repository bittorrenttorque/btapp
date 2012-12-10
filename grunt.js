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
    dependencies: [
      'components/jquery/jquery.js',
      'components/underscore/underscore.js',
      'components/jStorage/jstorage.js',
      'components/backbone/backbone.js'
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
      files: ['<config:files>','tests/spec/**/*.js']
    },
    watch: {
      files: ['<config:jasmine.specs>','*.js'],
      tasks: 'default'
    },
    jasmine : {
      all: ['tests/local/SpecRunner.html']
    },
    server: {
      base: '.',
      port: 8888
    },
    'saucelabs-jasmine': {
        all: {
            username: 'pwmckenna',
            key: '06ba33e4-781f-4f69-b943-f8903ef39fcc',
            urls: ['http://127.0.0.1:8888/tests/saucelabs/SpecRunner.html'],
            browsers: [
              {
                // prerun: 'http://torque.bittorrent.com/Torque.msi',
                // 'prerun-args': '/q'
                browserName: 'chrome',
                os: "Windows 2003",
              },
              {
                browserName: 'chrome',
                os: "Windows 2008"
              },
              {
                browserName: 'internet explorer',
                os: "Windows 2003",
                "browser-version": "8"
              }, 
              {
                browserName: 'internet explorer',
                os: "Windows 2008",
                "browser-version": "8"
              }, 
              {
                browserName: 'internet explorer',
                os: "Windows 2008",
                "browser-version": "9"
              }, 
              {
                browserName: 'firefox',
                os: "Windows 2003"
              },
              {
                browserName: 'firefox',
                os: "Windows 2008"
              }
            ],
            onTestComplete: function(){
                return;
            }
        }
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

  grunt.loadNpmTasks('grunt-saucelabs');
  grunt.loadNpmTasks('grunt-jasmine-task');
  grunt.registerTask('default', 'lint concat min sauce');
  grunt.registerTask('sauce', 'server saucelabs-jasmine')
};