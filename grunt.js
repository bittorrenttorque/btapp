/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    meta: {
      version: '0.1.0',
      banner: '/*! Btapp.js - v<%= meta.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '* http://btappjs.com/\n' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> ' +
        'Patrick Williams; Licensed MIT */'
    },
    lint: {
      files: ['btapp.js', 'client.btapp.js', 'plugin.btapp.js', 'pairing.btapp.js']
    },
    concat: {
      dist: {
        src: ['<banner:meta.banner>', '<file_strip_banner:!(grunt).js>'],
        dest: 'btapp.concat.js'
      }
    },
    min: {
      dist: {
        src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
        dest: 'dist/btapp.min.js'
      }
    },
    watch: {
      files: '<config:lint.files>',
      tasks: 'lint'
    },
    jshint: {
      options: {
        nomen: true,
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
        browser: true
      },
      globals: {
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
    },
    uglify: {}
  });

  // Default task.
  grunt.registerTask('default', 'lint concat min');

};
