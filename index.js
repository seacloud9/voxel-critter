var inherits = require('inherits');
var lsb = require('lsb');
var voxelMesh = require('voxel-engine/node_modules/voxel-mesh');
var voxel = require('voxel-engine/node_modules/voxel');
var Creature = require('voxel-creature').Creature;

function Critter(game, img, opts) {
    this.game = game;
    var data = load(img);
    var obj = this.build(data);
    Creature.call(this, game, obj, opts);
}
inherits(Critter, Creature);

module.exports = function(game) {
    return function(img, opts) {
        return new Critter(game, img, opts || {});
    };
};
module.exports.Critter = Critter;
module.exports.convertToVoxels = convertToVoxels
module.exports.load = load

Critter.prototype.build = function(hash) {
    var self = this;

    var converted = convertToVoxels(hash);
    var bounds = converted.bounds;
    var voxelData = converted.voxelData;
    var colors = converted.colors;

    // create voxels
    bounds[0] = bounds[0].map(function(b) {
        return b - 1;
    });
    bounds[1] = bounds[1].map(function(b) {
        return b + 1;
    });
    var voxels = voxel.generate(bounds[0], bounds[1], function(x, y, z) {
        return voxelData[[x, y, z].join('|')] || 0;
    });

    // create mesh
    var scale = 0.2;
    var mesh = voxelMesh(voxels, this.game.mesher, new this.game.THREE.Vector3(scale, scale, scale), this.game.THREE);
    var mat = new self.game.THREE.MeshBasicMaterial({
        vertexColors: this.game.THREE.FaceColors
    });
    mesh.createSurfaceMesh(mat);

    // colorize
    for (var i = 0; i < mesh.surfaceMesh.geometry.faces.length; i++) {
        var face = mesh.surfaceMesh.geometry.faces[i];
        var index = Math.floor(face.color.b * 255 + face.color.g * 255 * 255 + face.color.r * 255 * 255 * 255);
        var color = colors[index] || colors[0];
        face.color.setRGB(color[0], color[1], color[2]);
    }

    // center the geometry
    this.game.THREE.GeometryUtils.center(mesh.surfaceMesh.geometry);
    mesh.setPosition(0, 1.5, 0);

    // create creature
    var critter = new this.game.THREE.Object3D();
    critter.add(mesh.surfaceMesh);
    return critter;
};

function hex2rgb(hex) {
    if (hex[0] === '#') hex = hex.substr(1);
    return [parseInt(hex.substr(0, 2), 16) / 255, parseInt(hex.substr(2, 2), 16) / 255, parseInt(hex.substr(4, 2), 16) / 255];
}

function decode(string) {
    var output = [];
    string.split('').forEach(function(v) {
        output.push("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(v));
    });
    return output;
}

function convertToVoxels(hash) {
    var hashChunks = hash.split(':');
    var chunks = {};
    var colors = [0x000000];

    for (var j = 0; j < hashChunks.length; j++) {
        chunks[hashChunks[j][0]] = hashChunks[j].substr(2);
    }

    if (chunks['C']) {
        // decode colors
        colors = [];
        var hexColors = chunks['C'];
        for (var c = 0, nC = hexColors.length / 6; c < nC; c++) {
            var hex = hexColors.substr(c * 6, 6);
            colors[c] = hex2rgb(hex);
        }
    }

    if (chunks['A']) {
        // decode geo
        var current = [0, 0, 0, 0];
        var data = decode(chunks['A']);
        var i = 0,
            l = data.length;
        var voxelData = Object.create(null);
        var bounds = [
            [-1, -1, -1],
            [1, 1, 1]
        ];

        while (i < l) {
            var code = data[i++].toString(2);
            if (code.charAt(1) === '1') current[0] += data[i++] - 32;
            if (code.charAt(2) === '1') current[1] += data[i++] - 32;
            if (code.charAt(3) === '1') current[2] += data[i++] - 32;
            if (code.charAt(4) === '1') current[3] += data[i++] - 32;
            if (code.charAt(0) === '1') {
                if (current[0] < 0 && current[0] < bounds[0][0]) bounds[0][0] = current[0];
                if (current[0] > 0 && current[0] > bounds[1][0]) bounds[1][0] = current[0];
                if (current[1] < 0 && current[1] < bounds[0][1]) bounds[0][1] = current[1];
                if (current[1] > 0 && current[1] > bounds[1][1]) bounds[1][1] = current[1];
                if (current[2] < 0 && current[2] < bounds[0][2]) bounds[0][2] = current[2];
                if (current[2] > 0 && current[2] > bounds[1][2]) bounds[1][2] = current[2];
                voxelData[current.slice(0, 3).join('|')] = current.slice(3)[0];
            }
        }
    }

    return {
        voxelData: voxelData,
        colors: colors,
        bounds: bounds
    };
}

function load(image) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var width = canvas.width = image.width;
    var height = canvas.height = image.height;

    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);

    var imageData = ctx.getImageData(0, 0, width, height);
    var text = lsb.decode(imageData.data, function(idx) {
        return idx + (idx / 3) | 0;
    });

    // ignore images that weren't generated by voxel-painter
    if (text.slice(0, 14) !== 'voxel-painter:') return false;

    return text.slice(15);
};