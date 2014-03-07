module.exports = function(grunt) {
    'use strict';

    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);
    grunt.initConfig({
        jshint: {
            browser: {
                options: {
                    jshintrc: '.jshintrc-browser'
                },
                src: ['lib/**/*.js']
            },
            node: {
                options: {
                    jshintrc: '.jshintrc-node'
                },
                src: ['**/*.js', '!lib/**/*', '!node_modules/**/*', '!bower_components/**/*']
            }
        }
    });
};