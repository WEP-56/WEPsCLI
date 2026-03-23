import { c as commonjsGlobal, g as getDefaultExportFromCjs } from "./index.js";
import require$$4 from "util";
import path__default from "path";
import require$$0 from "fs";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var photon_rs$2 = { exports: {} };
photon_rs$2.exports;
var hasRequiredPhoton_rs;
function requirePhoton_rs() {
  if (hasRequiredPhoton_rs) return photon_rs$2.exports;
  hasRequiredPhoton_rs = 1;
  (function(module) {
    let imports = {};
    imports["__wbindgen_placeholder__"] = module.exports;
    let wasm;
    const { TextEncoder, TextDecoder } = require$$4;
    function debugString(val) {
      const type = typeof val;
      if (type == "number" || type == "boolean" || val == null) {
        return `${val}`;
      }
      if (type == "string") {
        return `"${val}"`;
      }
      if (type == "symbol") {
        const description = val.description;
        if (description == null) {
          return "Symbol";
        } else {
          return `Symbol(${description})`;
        }
      }
      if (type == "function") {
        const name = val.name;
        if (typeof name == "string" && name.length > 0) {
          return `Function(${name})`;
        } else {
          return "Function";
        }
      }
      if (Array.isArray(val)) {
        const length = val.length;
        let debug = "[";
        if (length > 0) {
          debug += debugString(val[0]);
        }
        for (let i = 1; i < length; i++) {
          debug += ", " + debugString(val[i]);
        }
        debug += "]";
        return debug;
      }
      const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
      let className;
      if (builtInMatches.length > 1) {
        className = builtInMatches[1];
      } else {
        return toString.call(val);
      }
      if (className == "Object") {
        try {
          return "Object(" + JSON.stringify(val) + ")";
        } catch (_) {
          return "Object";
        }
      }
      if (val instanceof Error) {
        return `${val.name}: ${val.message}
${val.stack}`;
      }
      return className;
    }
    let WASM_VECTOR_LEN = 0;
    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
      if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
      }
      return cachedUint8ArrayMemory0;
    }
    let cachedTextEncoder = new TextEncoder("utf-8");
    const encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
      return cachedTextEncoder.encodeInto(arg, view);
    } : function(arg, view) {
      const buf = cachedTextEncoder.encode(arg);
      view.set(buf);
      return {
        read: arg.length,
        written: buf.length
      };
    };
    function passStringToWasm0(arg, malloc, realloc) {
      if (realloc === void 0) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr2 = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr2;
      }
      let len = arg.length;
      let ptr = malloc(len, 1) >>> 0;
      const mem = getUint8ArrayMemory0();
      let offset = 0;
      for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 127) break;
        mem[ptr + offset] = code;
      }
      if (offset !== len) {
        if (offset !== 0) {
          arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);
        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
      }
      WASM_VECTOR_LEN = offset;
      return ptr;
    }
    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
      if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
      }
      return cachedDataViewMemory0;
    }
    let cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    function getStringFromWasm0(ptr, len) {
      ptr = ptr >>> 0;
      return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }
    function _assertClass(instance, klass) {
      if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
      }
      return instance.ptr;
    }
    module.exports.alter_channel = function(img, channel, amt) {
      _assertClass(img, PhotonImage);
      wasm.alter_channel(img.__wbg_ptr, channel, amt);
    };
    module.exports.alter_red_channel = function(photon_image, amt) {
      _assertClass(photon_image, PhotonImage);
      wasm.alter_red_channel(photon_image.__wbg_ptr, amt);
    };
    module.exports.alter_green_channel = function(img, amt) {
      _assertClass(img, PhotonImage);
      wasm.alter_green_channel(img.__wbg_ptr, amt);
    };
    module.exports.alter_blue_channel = function(img, amt) {
      _assertClass(img, PhotonImage);
      wasm.alter_blue_channel(img.__wbg_ptr, amt);
    };
    module.exports.alter_two_channels = function(img, channel1, amt1, channel2, amt2) {
      _assertClass(img, PhotonImage);
      wasm.alter_two_channels(img.__wbg_ptr, channel1, amt1, channel2, amt2);
    };
    module.exports.alter_channels = function(img, r_amt, g_amt, b_amt) {
      _assertClass(img, PhotonImage);
      wasm.alter_channels(img.__wbg_ptr, r_amt, g_amt, b_amt);
    };
    module.exports.remove_channel = function(img, channel, min_filter) {
      _assertClass(img, PhotonImage);
      wasm.remove_channel(img.__wbg_ptr, channel, min_filter);
    };
    module.exports.remove_red_channel = function(img, min_filter) {
      _assertClass(img, PhotonImage);
      wasm.remove_red_channel(img.__wbg_ptr, min_filter);
    };
    module.exports.remove_green_channel = function(img, min_filter) {
      _assertClass(img, PhotonImage);
      wasm.remove_green_channel(img.__wbg_ptr, min_filter);
    };
    module.exports.remove_blue_channel = function(img, min_filter) {
      _assertClass(img, PhotonImage);
      wasm.remove_blue_channel(img.__wbg_ptr, min_filter);
    };
    module.exports.swap_channels = function(img, channel1, channel2) {
      _assertClass(img, PhotonImage);
      wasm.swap_channels(img.__wbg_ptr, channel1, channel2);
    };
    module.exports.invert = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.invert(photon_image.__wbg_ptr);
    };
    module.exports.selective_hue_rotate = function(photon_image, ref_color, degrees) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(ref_color, Rgb);
      var ptr0 = ref_color.__destroy_into_raw();
      wasm.selective_hue_rotate(photon_image.__wbg_ptr, ptr0, degrees);
    };
    module.exports.selective_color_convert = function(photon_image, ref_color, new_color, fraction) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(ref_color, Rgb);
      var ptr0 = ref_color.__destroy_into_raw();
      _assertClass(new_color, Rgb);
      var ptr1 = new_color.__destroy_into_raw();
      wasm.selective_color_convert(photon_image.__wbg_ptr, ptr0, ptr1, fraction);
    };
    module.exports.selective_lighten = function(img, ref_color, amt) {
      _assertClass(img, PhotonImage);
      _assertClass(ref_color, Rgb);
      var ptr0 = ref_color.__destroy_into_raw();
      wasm.selective_lighten(img.__wbg_ptr, ptr0, amt);
    };
    module.exports.selective_desaturate = function(img, ref_color, amt) {
      _assertClass(img, PhotonImage);
      _assertClass(ref_color, Rgb);
      var ptr0 = ref_color.__destroy_into_raw();
      wasm.selective_desaturate(img.__wbg_ptr, ptr0, amt);
    };
    module.exports.selective_saturate = function(img, ref_color, amt) {
      _assertClass(img, PhotonImage);
      _assertClass(ref_color, Rgb);
      var ptr0 = ref_color.__destroy_into_raw();
      wasm.selective_saturate(img.__wbg_ptr, ptr0, amt);
    };
    module.exports.selective_greyscale = function(photon_image, ref_color) {
      _assertClass(photon_image, PhotonImage);
      var ptr0 = photon_image.__destroy_into_raw();
      _assertClass(ref_color, Rgb);
      var ptr1 = ref_color.__destroy_into_raw();
      wasm.selective_greyscale(ptr0, ptr1);
    };
    module.exports.monochrome = function(img, r_offset, g_offset, b_offset) {
      _assertClass(img, PhotonImage);
      wasm.monochrome(img.__wbg_ptr, r_offset, g_offset, b_offset);
    };
    module.exports.sepia = function(img) {
      _assertClass(img, PhotonImage);
      wasm.sepia(img.__wbg_ptr);
    };
    module.exports.grayscale = function(img) {
      _assertClass(img, PhotonImage);
      wasm.grayscale(img.__wbg_ptr);
    };
    module.exports.grayscale_human_corrected = function(img) {
      _assertClass(img, PhotonImage);
      wasm.grayscale_human_corrected(img.__wbg_ptr);
    };
    module.exports.desaturate = function(img) {
      _assertClass(img, PhotonImage);
      wasm.desaturate(img.__wbg_ptr);
    };
    module.exports.decompose_min = function(img) {
      _assertClass(img, PhotonImage);
      wasm.decompose_min(img.__wbg_ptr);
    };
    module.exports.decompose_max = function(img) {
      _assertClass(img, PhotonImage);
      wasm.decompose_max(img.__wbg_ptr);
    };
    module.exports.grayscale_shades = function(photon_image, num_shades) {
      _assertClass(photon_image, PhotonImage);
      wasm.grayscale_shades(photon_image.__wbg_ptr, num_shades);
    };
    module.exports.r_grayscale = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.r_grayscale(photon_image.__wbg_ptr);
    };
    module.exports.g_grayscale = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.g_grayscale(photon_image.__wbg_ptr);
    };
    module.exports.b_grayscale = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.b_grayscale(photon_image.__wbg_ptr);
    };
    module.exports.single_channel_grayscale = function(photon_image, channel) {
      _assertClass(photon_image, PhotonImage);
      wasm.single_channel_grayscale(photon_image.__wbg_ptr, channel);
    };
    module.exports.threshold = function(img, threshold) {
      _assertClass(img, PhotonImage);
      wasm.threshold(img.__wbg_ptr, threshold);
    };
    module.exports.gamma_correction = function(photon_image, red, green, blue) {
      _assertClass(photon_image, PhotonImage);
      wasm.gamma_correction(photon_image.__wbg_ptr, red, green, blue);
    };
    module.exports.hsluv = function(photon_image, mode, amt) {
      _assertClass(photon_image, PhotonImage);
      const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.hsluv(photon_image.__wbg_ptr, ptr0, len0, amt);
    };
    module.exports.lch = function(photon_image, mode, amt) {
      _assertClass(photon_image, PhotonImage);
      const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.lch(photon_image.__wbg_ptr, ptr0, len0, amt);
    };
    module.exports.hsl = function(photon_image, mode, amt) {
      _assertClass(photon_image, PhotonImage);
      const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.hsl(photon_image.__wbg_ptr, ptr0, len0, amt);
    };
    module.exports.hsv = function(photon_image, mode, amt) {
      _assertClass(photon_image, PhotonImage);
      const ptr0 = passStringToWasm0(mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.hsv(photon_image.__wbg_ptr, ptr0, len0, amt);
    };
    module.exports.hue_rotate_hsl = function(img, degrees) {
      _assertClass(img, PhotonImage);
      wasm.hue_rotate_hsl(img.__wbg_ptr, degrees);
    };
    module.exports.hue_rotate_hsv = function(img, degrees) {
      _assertClass(img, PhotonImage);
      wasm.hue_rotate_hsv(img.__wbg_ptr, degrees);
    };
    module.exports.hue_rotate_lch = function(img, degrees) {
      _assertClass(img, PhotonImage);
      wasm.hue_rotate_lch(img.__wbg_ptr, degrees);
    };
    module.exports.hue_rotate_hsluv = function(img, degrees) {
      _assertClass(img, PhotonImage);
      wasm.hue_rotate_hsluv(img.__wbg_ptr, degrees);
    };
    module.exports.saturate_hsl = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.saturate_hsl(img.__wbg_ptr, level);
    };
    module.exports.saturate_lch = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.saturate_lch(img.__wbg_ptr, level);
    };
    module.exports.saturate_hsluv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.saturate_hsluv(img.__wbg_ptr, level);
    };
    module.exports.saturate_hsv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.saturate_hsv(img.__wbg_ptr, level);
    };
    module.exports.lighten_lch = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.lighten_lch(img.__wbg_ptr, level);
    };
    module.exports.lighten_hsluv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.lighten_hsluv(img.__wbg_ptr, level);
    };
    module.exports.lighten_hsl = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.lighten_hsl(img.__wbg_ptr, level);
    };
    module.exports.lighten_hsv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.lighten_hsv(img.__wbg_ptr, level);
    };
    module.exports.darken_lch = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.darken_lch(img.__wbg_ptr, level);
    };
    module.exports.darken_hsluv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.darken_hsluv(img.__wbg_ptr, level);
    };
    module.exports.darken_hsl = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.darken_hsl(img.__wbg_ptr, level);
    };
    module.exports.darken_hsv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.darken_hsv(img.__wbg_ptr, level);
    };
    module.exports.desaturate_hsv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.desaturate_hsv(img.__wbg_ptr, level);
    };
    module.exports.desaturate_hsl = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.desaturate_hsl(img.__wbg_ptr, level);
    };
    module.exports.desaturate_lch = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.desaturate_lch(img.__wbg_ptr, level);
    };
    module.exports.desaturate_hsluv = function(img, level) {
      _assertClass(img, PhotonImage);
      wasm.desaturate_hsluv(img.__wbg_ptr, level);
    };
    module.exports.mix_with_colour = function(photon_image, mix_colour, opacity) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(mix_colour, Rgb);
      var ptr0 = mix_colour.__destroy_into_raw();
      wasm.mix_with_colour(photon_image.__wbg_ptr, ptr0, opacity);
    };
    module.exports.noise_reduction = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.noise_reduction(photon_image.__wbg_ptr);
    };
    module.exports.sharpen = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.sharpen(photon_image.__wbg_ptr);
    };
    module.exports.edge_detection = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.edge_detection(photon_image.__wbg_ptr);
    };
    module.exports.identity = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.identity(photon_image.__wbg_ptr);
    };
    module.exports.box_blur = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.box_blur(photon_image.__wbg_ptr);
    };
    module.exports.gaussian_blur = function(photon_image, radius) {
      _assertClass(photon_image, PhotonImage);
      wasm.gaussian_blur(photon_image.__wbg_ptr, radius);
    };
    module.exports.detect_horizontal_lines = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.detect_horizontal_lines(photon_image.__wbg_ptr);
    };
    module.exports.detect_vertical_lines = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.detect_vertical_lines(photon_image.__wbg_ptr);
    };
    module.exports.detect_45_deg_lines = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.detect_45_deg_lines(photon_image.__wbg_ptr);
    };
    module.exports.detect_135_deg_lines = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.detect_135_deg_lines(photon_image.__wbg_ptr);
    };
    module.exports.laplace = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.laplace(photon_image.__wbg_ptr);
    };
    module.exports.edge_one = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.edge_one(photon_image.__wbg_ptr);
    };
    module.exports.emboss = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.emboss(photon_image.__wbg_ptr);
    };
    module.exports.sobel_horizontal = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.sobel_horizontal(photon_image.__wbg_ptr);
    };
    module.exports.prewitt_horizontal = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.prewitt_horizontal(photon_image.__wbg_ptr);
    };
    module.exports.sobel_vertical = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.sobel_vertical(photon_image.__wbg_ptr);
    };
    module.exports.sobel_global = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.sobel_global(photon_image.__wbg_ptr);
    };
    module.exports.add_noise_rand = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.add_noise_rand(photon_image.__wbg_ptr);
    };
    module.exports.pink_noise = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.pink_noise(photon_image.__wbg_ptr);
    };
    module.exports.watermark = function(img, watermark, x, y) {
      _assertClass(img, PhotonImage);
      _assertClass(watermark, PhotonImage);
      wasm.watermark(img.__wbg_ptr, watermark.__wbg_ptr, x, y);
    };
    module.exports.blend = function(photon_image, photon_image2, blend_mode) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(photon_image2, PhotonImage);
      const ptr0 = passStringToWasm0(blend_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.blend(photon_image.__wbg_ptr, photon_image2.__wbg_ptr, ptr0, len0);
    };
    module.exports.create_gradient = function(width, height) {
      const ret = wasm.create_gradient(width, height);
      return PhotonImage.__wrap(ret);
    };
    module.exports.apply_gradient = function(image) {
      _assertClass(image, PhotonImage);
      wasm.apply_gradient(image.__wbg_ptr);
    };
    module.exports.neue = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.neue(photon_image.__wbg_ptr);
    };
    module.exports.lix = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.lix(photon_image.__wbg_ptr);
    };
    module.exports.ryo = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.ryo(photon_image.__wbg_ptr);
    };
    module.exports.filter = function(img, filter_name) {
      _assertClass(img, PhotonImage);
      const ptr0 = passStringToWasm0(filter_name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.filter(img.__wbg_ptr, ptr0, len0);
    };
    module.exports.lofi = function(img) {
      _assertClass(img, PhotonImage);
      wasm.lofi(img.__wbg_ptr);
    };
    module.exports.pastel_pink = function(img) {
      _assertClass(img, PhotonImage);
      wasm.pastel_pink(img.__wbg_ptr);
    };
    module.exports.golden = function(img) {
      _assertClass(img, PhotonImage);
      wasm.golden(img.__wbg_ptr);
    };
    module.exports.cali = function(img) {
      _assertClass(img, PhotonImage);
      wasm.cali(img.__wbg_ptr);
    };
    module.exports.dramatic = function(img) {
      _assertClass(img, PhotonImage);
      wasm.dramatic(img.__wbg_ptr);
    };
    module.exports.monochrome_tint = function(img, rgb_color) {
      _assertClass(img, PhotonImage);
      _assertClass(rgb_color, Rgb);
      var ptr0 = rgb_color.__destroy_into_raw();
      wasm.monochrome_tint(img.__wbg_ptr, ptr0);
    };
    module.exports.duotone_violette = function(img) {
      _assertClass(img, PhotonImage);
      wasm.duotone_violette(img.__wbg_ptr);
    };
    module.exports.duotone_horizon = function(img) {
      _assertClass(img, PhotonImage);
      wasm.duotone_horizon(img.__wbg_ptr);
    };
    module.exports.duotone_tint = function(img, rgb_color) {
      _assertClass(img, PhotonImage);
      _assertClass(rgb_color, Rgb);
      var ptr0 = rgb_color.__destroy_into_raw();
      wasm.duotone_tint(img.__wbg_ptr, ptr0);
    };
    module.exports.duotone_lilac = function(img) {
      _assertClass(img, PhotonImage);
      wasm.duotone_lilac(img.__wbg_ptr);
    };
    module.exports.duotone_ochre = function(img) {
      _assertClass(img, PhotonImage);
      wasm.duotone_ochre(img.__wbg_ptr);
    };
    module.exports.firenze = function(img) {
      _assertClass(img, PhotonImage);
      wasm.firenze(img.__wbg_ptr);
    };
    module.exports.obsidian = function(img) {
      _assertClass(img, PhotonImage);
      wasm.obsidian(img.__wbg_ptr);
    };
    module.exports.crop = function(photon_image, x1, y1, x2, y2) {
      _assertClass(photon_image, PhotonImage);
      const ret = wasm.crop(photon_image.__wbg_ptr, x1, y1, x2, y2);
      return PhotonImage.__wrap(ret);
    };
    module.exports.crop_img_browser = function(source_canvas, width, height, left, top) {
      const ret = wasm.crop_img_browser(source_canvas, width, height, left, top);
      return ret;
    };
    module.exports.fliph = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.fliph(photon_image.__wbg_ptr);
    };
    module.exports.flipv = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.flipv(photon_image.__wbg_ptr);
    };
    module.exports.resize_img_browser = function(photon_img, width, height, sampling_filter) {
      _assertClass(photon_img, PhotonImage);
      const ret = wasm.resize_img_browser(photon_img.__wbg_ptr, width, height, sampling_filter);
      return ret;
    };
    module.exports.resize = function(photon_img, width, height, sampling_filter) {
      _assertClass(photon_img, PhotonImage);
      const ret = wasm.resize(photon_img.__wbg_ptr, width, height, sampling_filter);
      return PhotonImage.__wrap(ret);
    };
    module.exports.seam_carve = function(img, width, height) {
      _assertClass(img, PhotonImage);
      const ret = wasm.seam_carve(img.__wbg_ptr, width, height);
      return PhotonImage.__wrap(ret);
    };
    module.exports.shearx = function(photon_img, shear) {
      _assertClass(photon_img, PhotonImage);
      const ret = wasm.shearx(photon_img.__wbg_ptr, shear);
      return PhotonImage.__wrap(ret);
    };
    module.exports.sheary = function(photon_img, shear) {
      _assertClass(photon_img, PhotonImage);
      const ret = wasm.sheary(photon_img.__wbg_ptr, shear);
      return PhotonImage.__wrap(ret);
    };
    module.exports.padding_uniform = function(img, padding, padding_rgba) {
      _assertClass(img, PhotonImage);
      _assertClass(padding_rgba, Rgba);
      var ptr0 = padding_rgba.__destroy_into_raw();
      const ret = wasm.padding_uniform(img.__wbg_ptr, padding, ptr0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.padding_left = function(img, padding, padding_rgba) {
      _assertClass(img, PhotonImage);
      _assertClass(padding_rgba, Rgba);
      var ptr0 = padding_rgba.__destroy_into_raw();
      const ret = wasm.padding_left(img.__wbg_ptr, padding, ptr0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.padding_right = function(img, padding, padding_rgba) {
      _assertClass(img, PhotonImage);
      _assertClass(padding_rgba, Rgba);
      var ptr0 = padding_rgba.__destroy_into_raw();
      const ret = wasm.padding_right(img.__wbg_ptr, padding, ptr0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.padding_top = function(img, padding, padding_rgba) {
      _assertClass(img, PhotonImage);
      _assertClass(padding_rgba, Rgba);
      var ptr0 = padding_rgba.__destroy_into_raw();
      const ret = wasm.padding_top(img.__wbg_ptr, padding, ptr0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.padding_bottom = function(img, padding, padding_rgba) {
      _assertClass(img, PhotonImage);
      _assertClass(padding_rgba, Rgba);
      var ptr0 = padding_rgba.__destroy_into_raw();
      const ret = wasm.padding_bottom(img.__wbg_ptr, padding, ptr0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.rotate = function(photon_img, angle) {
      _assertClass(photon_img, PhotonImage);
      const ret = wasm.rotate(photon_img.__wbg_ptr, angle);
      return PhotonImage.__wrap(ret);
    };
    module.exports.resample = function(img, dst_width, dst_height) {
      _assertClass(img, PhotonImage);
      const ret = wasm.resample(img.__wbg_ptr, dst_width, dst_height);
      return PhotonImage.__wrap(ret);
    };
    module.exports.offset = function(photon_image, channel_index, offset) {
      _assertClass(photon_image, PhotonImage);
      wasm.offset(photon_image.__wbg_ptr, channel_index, offset);
    };
    module.exports.offset_red = function(img, offset_amt) {
      _assertClass(img, PhotonImage);
      wasm.offset_red(img.__wbg_ptr, offset_amt);
    };
    module.exports.offset_green = function(img, offset_amt) {
      _assertClass(img, PhotonImage);
      wasm.offset_green(img.__wbg_ptr, offset_amt);
    };
    module.exports.offset_blue = function(img, offset_amt) {
      _assertClass(img, PhotonImage);
      wasm.offset_blue(img.__wbg_ptr, offset_amt);
    };
    module.exports.multiple_offsets = function(photon_image, offset, channel_index, channel_index2) {
      _assertClass(photon_image, PhotonImage);
      wasm.multiple_offsets(photon_image.__wbg_ptr, offset, channel_index, channel_index2);
    };
    module.exports.halftone = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.halftone(photon_image.__wbg_ptr);
    };
    module.exports.primary = function(img) {
      _assertClass(img, PhotonImage);
      wasm.primary(img.__wbg_ptr);
    };
    module.exports.colorize = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.colorize(photon_image.__wbg_ptr);
    };
    module.exports.solarize = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.solarize(photon_image.__wbg_ptr);
    };
    module.exports.solarize_retimg = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      const ret = wasm.solarize_retimg(photon_image.__wbg_ptr);
      return PhotonImage.__wrap(ret);
    };
    module.exports.adjust_brightness = function(photon_image, brightness) {
      _assertClass(photon_image, PhotonImage);
      wasm.adjust_brightness(photon_image.__wbg_ptr, brightness);
    };
    module.exports.inc_brightness = function(photon_image, brightness) {
      _assertClass(photon_image, PhotonImage);
      wasm.inc_brightness(photon_image.__wbg_ptr, brightness);
    };
    module.exports.dec_brightness = function(photon_image, brightness) {
      _assertClass(photon_image, PhotonImage);
      wasm.dec_brightness(photon_image.__wbg_ptr, brightness);
    };
    module.exports.adjust_contrast = function(photon_image, contrast) {
      _assertClass(photon_image, PhotonImage);
      wasm.adjust_contrast(photon_image.__wbg_ptr, contrast);
    };
    module.exports.tint = function(photon_image, r_offset, g_offset, b_offset) {
      _assertClass(photon_image, PhotonImage);
      wasm.tint(photon_image.__wbg_ptr, r_offset, g_offset, b_offset);
    };
    module.exports.horizontal_strips = function(photon_image, num_strips) {
      _assertClass(photon_image, PhotonImage);
      wasm.horizontal_strips(photon_image.__wbg_ptr, num_strips);
    };
    module.exports.color_horizontal_strips = function(photon_image, num_strips, color) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(color, Rgb);
      var ptr0 = color.__destroy_into_raw();
      wasm.color_horizontal_strips(photon_image.__wbg_ptr, num_strips, ptr0);
    };
    module.exports.vertical_strips = function(photon_image, num_strips) {
      _assertClass(photon_image, PhotonImage);
      wasm.vertical_strips(photon_image.__wbg_ptr, num_strips);
    };
    module.exports.color_vertical_strips = function(photon_image, num_strips, color) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(color, Rgb);
      var ptr0 = color.__destroy_into_raw();
      wasm.color_vertical_strips(photon_image.__wbg_ptr, num_strips, ptr0);
    };
    module.exports.oil = function(photon_image, radius, intensity) {
      _assertClass(photon_image, PhotonImage);
      wasm.oil(photon_image.__wbg_ptr, radius, intensity);
    };
    module.exports.frosted_glass = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.frosted_glass(photon_image.__wbg_ptr);
    };
    module.exports.pixelize = function(photon_image, pixel_size) {
      _assertClass(photon_image, PhotonImage);
      wasm.pixelize(photon_image.__wbg_ptr, pixel_size);
    };
    module.exports.normalize = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      wasm.normalize(photon_image.__wbg_ptr);
    };
    module.exports.dither = function(photon_image, depth) {
      _assertClass(photon_image, PhotonImage);
      wasm.dither(photon_image.__wbg_ptr, depth);
    };
    module.exports.duotone = function(photon_image, color_a, color_b) {
      _assertClass(photon_image, PhotonImage);
      _assertClass(color_a, Rgb);
      var ptr0 = color_a.__destroy_into_raw();
      _assertClass(color_b, Rgb);
      var ptr1 = color_b.__destroy_into_raw();
      wasm.duotone(photon_image.__wbg_ptr, ptr0, ptr1);
    };
    module.exports.draw_text_with_border = function(photon_img, text, x, y, font_size) {
      _assertClass(photon_img, PhotonImage);
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.draw_text_with_border(photon_img.__wbg_ptr, ptr0, len0, x, y, font_size);
    };
    module.exports.draw_text = function(photon_img, text, x, y, font_size) {
      _assertClass(photon_img, PhotonImage);
      const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.draw_text(photon_img.__wbg_ptr, ptr0, len0, x, y, font_size);
    };
    function passArray8ToWasm0(arg, malloc) {
      const ptr = malloc(arg.length * 1, 1) >>> 0;
      getUint8ArrayMemory0().set(arg, ptr / 1);
      WASM_VECTOR_LEN = arg.length;
      return ptr;
    }
    function getArrayU8FromWasm0(ptr, len) {
      ptr = ptr >>> 0;
      return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }
    function takeFromExternrefTable0(idx) {
      const value = wasm.__wbindgen_export_2.get(idx);
      wasm.__externref_table_dealloc(idx);
      return value;
    }
    module.exports.run = function() {
      const ret = wasm.run();
      if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
      }
    };
    module.exports.get_image_data = function(canvas, ctx) {
      const ret = wasm.get_image_data(canvas, ctx);
      return ret;
    };
    module.exports.putImageData = function(canvas, ctx, new_image) {
      _assertClass(new_image, PhotonImage);
      var ptr0 = new_image.__destroy_into_raw();
      wasm.putImageData(canvas, ctx, ptr0);
    };
    module.exports.open_image = function(canvas, ctx) {
      const ret = wasm.open_image(canvas, ctx);
      return PhotonImage.__wrap(ret);
    };
    module.exports.to_raw_pixels = function(imgdata) {
      const ret = wasm.to_raw_pixels(imgdata);
      var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
      return v1;
    };
    module.exports.base64_to_image = function(base64) {
      const ptr0 = passStringToWasm0(base64, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.base64_to_image(ptr0, len0);
      return PhotonImage.__wrap(ret);
    };
    module.exports.base64_to_vec = function(base64) {
      const ptr0 = passStringToWasm0(base64, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      const ret = wasm.base64_to_vec(ptr0, len0);
      var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
      return v2;
    };
    module.exports.to_image_data = function(photon_image) {
      _assertClass(photon_image, PhotonImage);
      var ptr0 = photon_image.__destroy_into_raw();
      const ret = wasm.to_image_data(ptr0);
      return ret;
    };
    function isLikeNone(x) {
      return x === void 0 || x === null;
    }
    function addToExternrefTable0(obj) {
      const idx = wasm.__externref_table_alloc();
      wasm.__wbindgen_export_2.set(idx, obj);
      return idx;
    }
    function handleError(f, args) {
      try {
        return f.apply(this, args);
      } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
      }
    }
    let cachedUint8ClampedArrayMemory0 = null;
    function getUint8ClampedArrayMemory0() {
      if (cachedUint8ClampedArrayMemory0 === null || cachedUint8ClampedArrayMemory0.byteLength === 0) {
        cachedUint8ClampedArrayMemory0 = new Uint8ClampedArray(wasm.memory.buffer);
      }
      return cachedUint8ClampedArrayMemory0;
    }
    function getClampedArrayU8FromWasm0(ptr, len) {
      ptr = ptr >>> 0;
      return getUint8ClampedArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
    }
    module.exports.SamplingFilter = Object.freeze({ Nearest: 1, "1": "Nearest", Triangle: 2, "2": "Triangle", CatmullRom: 3, "3": "CatmullRom", Gaussian: 4, "4": "Gaussian", Lanczos3: 5, "5": "Lanczos3" });
    const PhotonImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_photonimage_free(ptr >>> 0, 1));
    class PhotonImage {
      static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(PhotonImage.prototype);
        obj.__wbg_ptr = ptr;
        PhotonImageFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
      }
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PhotonImageFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_photonimage_free(ptr, 0);
      }
      /**
       * Create a new PhotonImage from a Vec of u8s, which represent raw pixels.
       * @param {Uint8Array} raw_pixels
       * @param {number} width
       * @param {number} height
       */
      constructor(raw_pixels, width, height) {
        const ptr0 = passArray8ToWasm0(raw_pixels, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.photonimage_new(ptr0, len0, width, height);
        this.__wbg_ptr = ret >>> 0;
        PhotonImageFinalization.register(this, this.__wbg_ptr, this);
        return this;
      }
      /**
       * Create a new PhotonImage from a base64 string.
       * @param {string} base64
       * @returns {PhotonImage}
       */
      static new_from_base64(base64) {
        const ptr0 = passStringToWasm0(base64, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.base64_to_image(ptr0, len0);
        return PhotonImage.__wrap(ret);
      }
      /**
       * Create a new PhotonImage from a byteslice.
       * @param {Uint8Array} vec
       * @returns {PhotonImage}
       */
      static new_from_byteslice(vec) {
        const ptr0 = passArray8ToWasm0(vec, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.photonimage_new_from_byteslice(ptr0, len0);
        return PhotonImage.__wrap(ret);
      }
      /**
       * Create a new PhotonImage from a Blob/File.
       * @param {Blob} blob
       * @returns {PhotonImage}
       */
      static new_from_blob(blob) {
        const ret = wasm.photonimage_new_from_blob(blob);
        return PhotonImage.__wrap(ret);
      }
      /**
       * Create a new PhotonImage from a HTMLImageElement
       * @param {HTMLImageElement} image
       * @returns {PhotonImage}
       */
      static new_from_image(image) {
        const ret = wasm.photonimage_new_from_image(image);
        return PhotonImage.__wrap(ret);
      }
      /**
       * Get the width of the PhotonImage.
       * @returns {number}
       */
      get_width() {
        const ret = wasm.photonimage_get_width(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
       * Get the PhotonImage's pixels as a Vec of u8s.
       * @returns {Uint8Array}
       */
      get_raw_pixels() {
        const ret = wasm.photonimage_get_raw_pixels(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
      }
      /**
       * Get the height of the PhotonImage.
       * @returns {number}
       */
      get_height() {
        const ret = wasm.photonimage_get_height(this.__wbg_ptr);
        return ret >>> 0;
      }
      /**
       * Convert the PhotonImage to base64.
       * @returns {string}
       */
      get_base64() {
        let deferred1_0;
        let deferred1_1;
        try {
          const ret = wasm.photonimage_get_base64(this.__wbg_ptr);
          deferred1_0 = ret[0];
          deferred1_1 = ret[1];
          return getStringFromWasm0(ret[0], ret[1]);
        } finally {
          wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
      }
      /**
       * Convert the PhotonImage to raw bytes. Returns PNG.
       * @returns {Uint8Array}
       */
      get_bytes() {
        const ret = wasm.photonimage_get_bytes(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
      }
      /**
       * Convert the PhotonImage to raw bytes. Returns a JPEG.
       * @param {number} quality
       * @returns {Uint8Array}
       */
      get_bytes_jpeg(quality) {
        const ret = wasm.photonimage_get_bytes_jpeg(this.__wbg_ptr, quality);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
      }
      /**
       * Convert the PhotonImage to raw bytes. Returns a WEBP.
       * @returns {Uint8Array}
       */
      get_bytes_webp() {
        const ret = wasm.photonimage_get_bytes_webp(this.__wbg_ptr);
        var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v1;
      }
      /**
       * Convert the PhotonImage's raw pixels to JS-compatible ImageData.
       * @returns {ImageData}
       */
      get_image_data() {
        const ret = wasm.photonimage_get_image_data(this.__wbg_ptr);
        return ret;
      }
      /**
       * Convert ImageData to raw pixels, and update the PhotonImage's raw pixels to this.
       * @param {ImageData} img_data
       */
      set_imgdata(img_data) {
        wasm.photonimage_set_imgdata(this.__wbg_ptr, img_data);
      }
      /**
       * Calculates estimated filesize and returns number of bytes
       * @returns {bigint}
       */
      get_estimated_filesize() {
        const ret = wasm.photonimage_get_estimated_filesize(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
      }
    }
    module.exports.PhotonImage = PhotonImage;
    const RgbFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_rgb_free(ptr >>> 0, 1));
    class Rgb {
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RgbFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rgb_free(ptr, 0);
      }
      /**
       * Create a new RGB struct.
       * @param {number} r
       * @param {number} g
       * @param {number} b
       */
      constructor(r, g, b) {
        const ret = wasm.rgb_new(r, g, b);
        this.__wbg_ptr = ret >>> 0;
        RgbFinalization.register(this, this.__wbg_ptr, this);
        return this;
      }
      /**
       * Set the Red value.
       * @param {number} r
       */
      set_red(r) {
        wasm.rgb_set_red(this.__wbg_ptr, r);
      }
      /**
       * Get the Green value.
       * @param {number} g
       */
      set_green(g) {
        wasm.rgb_set_green(this.__wbg_ptr, g);
      }
      /**
       * Set the Blue value.
       * @param {number} b
       */
      set_blue(b) {
        wasm.rgb_set_blue(this.__wbg_ptr, b);
      }
      /**
       * Get the Red value.
       * @returns {number}
       */
      get_red() {
        const ret = wasm.rgb_get_red(this.__wbg_ptr);
        return ret;
      }
      /**
       * Get the Green value.
       * @returns {number}
       */
      get_green() {
        const ret = wasm.rgb_get_green(this.__wbg_ptr);
        return ret;
      }
      /**
       * Get the Blue value.
       * @returns {number}
       */
      get_blue() {
        const ret = wasm.rgb_get_blue(this.__wbg_ptr);
        return ret;
      }
    }
    module.exports.Rgb = Rgb;
    const RgbaFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
    }, unregister: () => {
    } } : new FinalizationRegistry((ptr) => wasm.__wbg_rgba_free(ptr >>> 0, 1));
    class Rgba {
      __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RgbaFinalization.unregister(this);
        return ptr;
      }
      free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rgba_free(ptr, 0);
      }
      /**
       * Create a new RGBA struct.
       * @param {number} r
       * @param {number} g
       * @param {number} b
       * @param {number} a
       */
      constructor(r, g, b, a) {
        const ret = wasm.rgba_new(r, g, b, a);
        this.__wbg_ptr = ret >>> 0;
        RgbaFinalization.register(this, this.__wbg_ptr, this);
        return this;
      }
      /**
       * Set the Red value.
       * @param {number} r
       */
      set_red(r) {
        wasm.rgb_set_red(this.__wbg_ptr, r);
      }
      /**
       * Get the Green value.
       * @param {number} g
       */
      set_green(g) {
        wasm.rgb_set_green(this.__wbg_ptr, g);
      }
      /**
       * Set the Blue value.
       * @param {number} b
       */
      set_blue(b) {
        wasm.rgb_set_blue(this.__wbg_ptr, b);
      }
      /**
       * Set the alpha value.
       * @param {number} a
       */
      set_alpha(a) {
        wasm.rgba_set_alpha(this.__wbg_ptr, a);
      }
      /**
       * Get the Red value.
       * @returns {number}
       */
      get_red() {
        const ret = wasm.rgb_get_red(this.__wbg_ptr);
        return ret;
      }
      /**
       * Get the Green value.
       * @returns {number}
       */
      get_green() {
        const ret = wasm.rgb_get_green(this.__wbg_ptr);
        return ret;
      }
      /**
       * Get the Blue value.
       * @returns {number}
       */
      get_blue() {
        const ret = wasm.rgb_get_blue(this.__wbg_ptr);
        return ret;
      }
      /**
       * Get the alpha value for this color.
       * @returns {number}
       */
      get_alpha() {
        const ret = wasm.rgba_get_alpha(this.__wbg_ptr);
        return ret;
      }
    }
    module.exports.Rgba = Rgba;
    module.exports.__wbg_new_abda76e883ba8a5f = function() {
      const ret = new Error();
      return ret;
    };
    module.exports.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
      const ret = arg1.stack;
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    module.exports.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
      let deferred0_0;
      let deferred0_1;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
      } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
      }
    };
    module.exports.__wbg_instanceof_Window_c4b70662a0d2c5ec = function(arg0) {
      let result;
      try {
        result = arg0 instanceof Window;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    };
    module.exports.__wbg_document_e5c1786dea6542e4 = function(arg0) {
      const ret = arg0.document;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    module.exports.__wbg_body_e70ae6abd01ae584 = function(arg0) {
      const ret = arg0.body;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    };
    module.exports.__wbg_createElement_5d4c76f218b78145 = function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.createElement(getStringFromWasm0(arg1, arg2));
        return ret;
      }, arguments);
    };
    module.exports.__wbg_width_4c6f0048d64cf86b = function(arg0) {
      const ret = arg0.width;
      return ret;
    };
    module.exports.__wbg_height_21f0d3fd8f753394 = function(arg0) {
      const ret = arg0.height;
      return ret;
    };
    module.exports.__wbg_width_79e0847ed5883b03 = function(arg0) {
      const ret = arg0.width;
      return ret;
    };
    module.exports.__wbg_height_e4e4e4779f8feac0 = function(arg0) {
      const ret = arg0.height;
      return ret;
    };
    module.exports.__wbg_data_fda507064d127f5b = function(arg0, arg1) {
      const ret = arg1.data;
      const ptr1 = passArray8ToWasm0(ret, wasm.__wbindgen_malloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    module.exports.__wbg_newwithu8clampedarrayandsh_1fddccb3a94a5e05 = function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        const ret = new ImageData(getClampedArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
        return ret;
      }, arguments);
    };
    module.exports.__wbg_instanceof_CanvasRenderingContext2d_3abbe7ec7af32cae = function(arg0) {
      let result;
      try {
        result = arg0 instanceof CanvasRenderingContext2D;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    };
    module.exports.__wbg_drawImage_fede06db74e39a60 = function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        arg0.drawImage(arg1, arg2, arg3);
      }, arguments);
    };
    module.exports.__wbg_drawImage_f395c8e43c79a909 = function() {
      return handleError(function(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) {
        arg0.drawImage(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9);
      }, arguments);
    };
    module.exports.__wbg_getImageData_5e1c242046e6b59e = function() {
      return handleError(function(arg0, arg1, arg2, arg3, arg4) {
        const ret = arg0.getImageData(arg1, arg2, arg3, arg4);
        return ret;
      }, arguments);
    };
    module.exports.__wbg_putImageData_a8b3e177ee06d521 = function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        arg0.putImageData(arg1, arg2, arg3);
      }, arguments);
    };
    module.exports.__wbg_instanceof_HtmlCanvasElement_25d964a0dde6717e = function(arg0) {
      let result;
      try {
        result = arg0 instanceof HTMLCanvasElement;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    };
    module.exports.__wbg_width_dc225e55343b745e = function(arg0) {
      const ret = arg0.width;
      return ret;
    };
    module.exports.__wbg_setwidth_488780db69b08846 = function(arg0, arg1) {
      arg0.width = arg1 >>> 0;
    };
    module.exports.__wbg_height_3a8bec2f3fe71b26 = function(arg0) {
      const ret = arg0.height;
      return ret;
    };
    module.exports.__wbg_setheight_1761808c18403921 = function(arg0, arg1) {
      arg0.height = arg1 >>> 0;
    };
    module.exports.__wbg_getContext_fc99dbd3a9a7e318 = function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
        return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
      }, arguments);
    };
    module.exports.__wbg_settextContent_f82a86a8df347e1c = function(arg0, arg1, arg2) {
      arg0.textContent = arg1 === 0 ? void 0 : getStringFromWasm0(arg1, arg2);
    };
    module.exports.__wbg_appendChild_fa3b00dade9fc4cf = function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.appendChild(arg1);
        return ret;
      }, arguments);
    };
    module.exports.__wbg_newnoargs_e643855c6572a4a8 = function(arg0, arg1) {
      const ret = new Function(getStringFromWasm0(arg0, arg1));
      return ret;
    };
    module.exports.__wbg_call_f96b398515635514 = function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
      }, arguments);
    };
    module.exports.__wbg_self_b9aad7f1c618bfaf = function() {
      return handleError(function() {
        const ret = self.self;
        return ret;
      }, arguments);
    };
    module.exports.__wbg_window_55e469842c98b086 = function() {
      return handleError(function() {
        const ret = window.window;
        return ret;
      }, arguments);
    };
    module.exports.__wbg_globalThis_d0957e302752547e = function() {
      return handleError(function() {
        const ret = globalThis.globalThis;
        return ret;
      }, arguments);
    };
    module.exports.__wbg_global_ae2f87312b8987fb = function() {
      return handleError(function() {
        const ret = commonjsGlobal.global;
        return ret;
      }, arguments);
    };
    module.exports.__wbindgen_is_undefined = function(arg0) {
      const ret = arg0 === void 0;
      return ret;
    };
    module.exports.__wbg_buffer_fcbfb6d88b2732e9 = function(arg0) {
      const ret = arg0.buffer;
      return ret;
    };
    module.exports.__wbg_new_bc5d9aad3f9ac80e = function(arg0) {
      const ret = new Uint8Array(arg0);
      return ret;
    };
    module.exports.__wbg_set_4b3aa8445ac1e91c = function(arg0, arg1, arg2) {
      arg0.set(arg1, arg2 >>> 0);
    };
    module.exports.__wbg_length_d9c4ded7e708c6a1 = function(arg0) {
      const ret = arg0.length;
      return ret;
    };
    module.exports.__wbindgen_debug_string = function(arg0, arg1) {
      const ret = debugString(arg1);
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    module.exports.__wbindgen_throw = function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    };
    module.exports.__wbindgen_memory = function() {
      const ret = wasm.memory;
      return ret;
    };
    module.exports.__wbindgen_init_externref_table = function() {
      const table = wasm.__wbindgen_export_2;
      const offset = table.grow(4);
      table.set(0, void 0);
      table.set(offset + 0, void 0);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    };
    const path = path__default.join(__dirname, "photon_rs_bg.wasm");
    const bytes = require$$0.readFileSync(path);
    const wasmModule = new WebAssembly.Module(bytes);
    const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
    wasm = wasmInstance.exports;
    module.exports.__wasm = wasm;
    wasm.__wbindgen_start();
  })(photon_rs$2);
  return photon_rs$2.exports;
}
var photon_rsExports = requirePhoton_rs();
const photon_rs = /* @__PURE__ */ getDefaultExportFromCjs(photon_rsExports);
const photon_rs$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: photon_rs
}, [photon_rsExports]);
export {
  photon_rs$1 as p
};
