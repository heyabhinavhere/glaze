/**
 * Per-lens GL resources — backdrop texture + blur FBO ping-pong textures.
 *
 * Allocated when a Lens registers with SharedRenderer; freed when it
 * unregisters. The shared offscreen GL context owns these objects;
 * they're per-lens because (for now) each lens has its own backdrop
 * texture. Sub-task 5 introduces backdrop-texture sharing across lenses
 * when multiple targets refract the same source — at that point this
 * struct keys by backdrop instead of by lens.
 *
 * Sub-task 3d adds the shared FBO pool (§3.4 in the design doc) which
 * collapses the FBO textures into a single pool sized to the largest
 * lens. For 3c we keep them per-lens; the API for this struct is
 * already shaped so the pool refactor is mechanical.
 */

export interface LensGLResources {
  /** Source backdrop texture. Null until the image has loaded + uploaded. */
  texture: WebGLTexture | null;
  /** Backdrop texture's natural dimensions in pixels. */
  textureW: number;
  textureH: number;

  /** Body-blur output (heavy, frost-driven). */
  blurTexA: WebGLTexture; // intermediate (after H pass)
  blurTexB: WebGLTexture; // final body-blur output

  /** Rim-blur output (fixed soft radius for the rim displacement source).
   *  Always blurred even when frost=0 so the rim has consistent character
   *  regardless of body frost (Figma's behavior). */
  lightTexA: WebGLTexture; // intermediate
  lightTexB: WebGLTexture; // final rim-blur output

  /** Single FBO reused for all blur passes — we re-bind the color
   *  attachment between passes rather than allocating multiple FBOs. */
  fbo: WebGLFramebuffer;

  /** FBO texture allocation size. Re-allocated when textureW/H changes. */
  fboW: number;
  fboH: number;

  /** Cached body-blur radius from last render. Skips re-blurring when the
   *  backdrop hasn't changed AND the frost amount hasn't moved. Tagged
   *  with a 0.5px threshold so smooth frost animations don't thrash. */
  lastBlurRadius: number;

  /** Marked when the source texture changes. Body blur runs next frame. */
  bodyBlurDirty: boolean;
  /** Marked when the source texture changes. Light blur runs next frame. */
  lightBlurDirty: boolean;
}

export function createLensGLResources(
  gl: WebGL2RenderingContext,
): LensGLResources {
  return {
    texture: null,
    textureW: 0,
    textureH: 0,
    blurTexA: gl.createTexture()!,
    blurTexB: gl.createTexture()!,
    lightTexA: gl.createTexture()!,
    lightTexB: gl.createTexture()!,
    fbo: gl.createFramebuffer()!,
    fboW: 0,
    fboH: 0,
    lastBlurRadius: -1,
    bodyBlurDirty: true,
    lightBlurDirty: true,
  };
}

export function disposeLensGLResources(
  gl: WebGL2RenderingContext,
  res: LensGLResources,
): void {
  if (res.texture) gl.deleteTexture(res.texture);
  gl.deleteTexture(res.blurTexA);
  gl.deleteTexture(res.blurTexB);
  gl.deleteTexture(res.lightTexA);
  gl.deleteTexture(res.lightTexB);
  gl.deleteFramebuffer(res.fbo);
}

/** Allocate the four FBO textures at the given backdrop size. Idempotent —
 *  no-op when the size matches the cached fboW/fboH. */
export function ensureFBOTextures(
  gl: WebGL2RenderingContext,
  res: LensGLResources,
): void {
  if (res.fboW === res.textureW && res.fboH === res.textureH) return;
  if (res.textureW === 0 || res.textureH === 0) return;

  const allocate = (tex: WebGLTexture): void => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      res.textureW,
      res.textureH,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  allocate(res.blurTexA);
  allocate(res.blurTexB);
  allocate(res.lightTexA);
  allocate(res.lightTexB);

  res.fboW = res.textureW;
  res.fboH = res.textureH;
}
