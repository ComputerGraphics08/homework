const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

async function loadShaderSource(url) {
  const res = await fetch(url);
  return await res.text();
}

async function main() {
  const vertexShaderSource = await loadShaderSource("vertex.glsl");
  const fragmentShaderSource = await loadShaderSource("fragment.glsl");

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
    }
    return shader;
  }

  function createProgram(gl, vShader, fShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
    }
    return program;
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vertexShader, fragmentShader);

  const squareVertices = [
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
    -0.5,  0.5, 0,
    -0.5,  0.5, 0,
     0.5, -0.5, 0,
     0.5,  0.5, 0,
  ];

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareVertices), gl.STATIC_DRAW);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const positionLoc = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

  const uModelLoc = gl.getUniformLocation(program, "u_model");
  const uColorLoc = gl.getUniformLocation(program, "u_color");

  gl.useProgram(program);
  gl.bindVertexArray(vao);
  gl.clearColor(0, 0, 0, 1);

  function drawObject(scale, rotationSpeed, translation, color, time) {
    const model = glMatrix.mat4.create();
    glMatrix.mat4.translate(model, model, translation);
    glMatrix.mat4.rotateZ(model, model, time * rotationSpeed);
    glMatrix.mat4.scale(model, model, [scale, scale, scale]);
    gl.uniformMatrix4fv(uModelLoc, false, model);
    gl.uniform4fv(uColorLoc, color);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render(time) {
    time *= 0.001;
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawObject(0.2, Math.PI / 4, [0, 0, 0], [1, 0, 0, 1], time); // Sun

    const earthOrbit = 0.7;
    const earthAngle = time * Math.PI / 2;
    const earthX = earthOrbit * Math.cos(earthAngle);
    const earthY = earthOrbit * Math.sin(earthAngle);
    drawObject(0.1, Math.PI, [earthX, earthY, 0], [0, 1, 1, 1], time); // Earth

    const moonOrbit = 0.2;
    const moonAngle = time * 2 * Math.PI;
    const moonX = earthX + moonOrbit * Math.cos(moonAngle);
    const moonY = earthY + moonOrbit * Math.sin(moonAngle);
    drawObject(0.05, Math.PI, [moonX, moonY, 0], [1, 1, 0, 1], time); // Moon

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
