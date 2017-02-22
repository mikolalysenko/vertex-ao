var regl = require('regl')()
var camera = require('regl-camera')(regl, {
  distance: 30,
  center: [0, 2.5, 0]
})

var bunny = require('./ao-bunny.json')

var drawBunny = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  attribute float ao;
  varying float ambient;
  uniform mat4 projection, view;
  void main () {
    ambient = (1. - ao) * (0.5 * max(normal.x, 0.) + 0.5);
    gl_Position = projection * view * vec4(position, 1);
  }
  `,

  frag: `
  precision mediump float;
  varying float ambient;
  void main () {
    gl_FragColor = vec4(vec3(ambient), 1);
  }
  `,

  attributes: {
    position: bunny.positions,
    normal: bunny.normals,
    ao: bunny.ao
  },

  elements: bunny.cells
})

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })

  camera(() => {
    drawBunny()
  })
})
