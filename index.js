var boxIntersect = require('box-intersect')
var sampleSphere = require('sphere-random')
var rti = require('ray-triangle-intersection')

module.exports = function calcAO (cells, positions, radius, numRays) {
  var triBoxes = new Array(cells.length)
  var sampleBoxes = new Array(cells.length)
  var centroids = new Array(cells.length)
  var normals = new Array(cells.length)

  for (var i = 0; i < cells.length; ++i) {
    var f = cells[i]
    var a = positions[f[0]]
    var b = positions[f[1]]
    var c = positions[f[2]]

    triBoxes[i] = [
      Math.min(a[0], b[0], c[0]),
      Math.min(a[1], b[1], c[1]),
      Math.min(a[2], b[2], c[2]),
      Math.max(a[0], b[0], c[0]),
      Math.max(a[1], b[1], c[1]),
      Math.max(a[2], b[2], c[2])
    ]

    centroids[i] = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3
    ]

    normals[i] = calcNormal(a, b, c)

    sampleBoxes[i] = [
      centroids[i][0] - radius,
      centroids[i][1] - radius,
      centroids[i][2] - radius,
      centroids[i][0] + radius,
      centroids[i][1] + radius,
      centroids[i][2] + radius
    ]
  }

  var cellAO = castRays(cells, positions, centroids, normals, triBoxes, sampleBoxes, numRays)

  // compute per-vertex ao
  return vertexAO(cells, positions, cellAO)
}

function calcNormal (a, b, c) {
  var ab = [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2]
  ]
  var ac = [
    a[0] - c[0],
    a[1] - c[1],
    a[2] - c[2]
  ]
  var n = new Array(3)
  var l2 = 0
  for (var i = 0; i < 3; ++i) {
    var u = (i + 1) % 3
    var v = (i + 2) % 3
    var x = n[i] = ab[u] * ac[v] - ab[v] * ac[u]
    l2 += Math.pow(x, 2)
  }
  var l = -Math.sqrt(l2)
  for (i = 0; i < 3; ++i) {
    n[i] /= l
  }
  return n
}

function computeBuckets (sampleBoxes, triBoxes) {
  var buckets = new Array(sampleBoxes.length)
  for (var i = 0; i < sampleBoxes.length; ++i) {
    buckets[i] = []
  }
  boxIntersect(sampleBoxes, triBoxes, function (sampleId, cellId) {
    if (cellId !== sampleId) {
      buckets[sampleId].push(cellId)
    }
  })
  return buckets
}

function castRays (cells, positions, centroids, normals, triBoxes, sampleBoxes, numRays) {
  var i

  var buckets = computeBuckets(sampleBoxes, triBoxes)

  var ao = new Array(buckets.length)
  for (i = 0; i < buckets.length; ++i) {
    var hits = 0
    var n = normals[i]
    var c = centroids[i]
    for (var j = 0; j < numRays; ++j) {
      var ray = sampleSphere(3)
      if (ray[0] * n[0] + ray[1] * n[1] + ray[2] * n[2] < 0) {
        ray[0] = -ray[0]
        ray[1] = -ray[1]
        ray[2] = -ray[2]
      }
      if (rayHit(cells, positions, buckets[i], ray, c)) {
        hits += 1
      }
    }
    ao[i] = hits / numRays
  }

  return ao
}

function rayHit (cells, positions, bucket, ray, origin) {
  var out = [0, 0, 0]

  for (var i = 0; i < bucket.length; ++i) {
    var f = cells[bucket[i]]

    var a = positions[f[0]]
    var b = positions[f[1]]
    var c = positions[f[2]]

    if (rti(out, origin, ray, [a, b, c])) {
      return true
    }
  }

  return false
}

function vertexAO (cells, positions, cellAO) {
  var i

  var vertAO = new Array(positions.length)
  var weights = new Array(positions.length)
  for (i = 0; i < positions.length; ++i) {
    vertAO[i] = 0
    weights[i] = 0
  }

  for (i = 0; i < cells.length; ++i) {
    var f = cells[i]

    var x = f[0]
    var y = f[1]
    var z = f[2]

    var a = positions[x]
    var b = positions[y]
    var c = positions[z]

    var ab = direction(a, b)
    var bc = direction(b, c)
    var ca = direction(c, a)

    var t0 = angle(ab, ca)
    var t1 = angle(bc, ab)
    var t2 = angle(ca, bc)

    var ao = cellAO[i]

    vertAO[x] += t0 * ao
    weights[x] += t0
    vertAO[y] += t1 * ao
    weights[y] += t1
    vertAO[z] += t2 * ao
    weights[z] += t2
  }

  for (i = 0; i < positions.length; ++i) {
    vertAO[i] /= weights[i]
  }

  return vertAO
}

function direction (a, b) {
  var x = a[0] - b[0]
  var y = a[1] - b[1]
  var z = a[2] - b[2]
  var l = Math.sqrt(
    Math.pow(x, 2) +
    Math.pow(y, 2) +
    Math.pow(z, 2))
  return [ x / l, y / l, z / l ]
}

function angle (a, b) {
  return Math.acos(-(
    a[0] * b[0] +
    a[1] * b[1] +
    a[2] * b[2]))
}
