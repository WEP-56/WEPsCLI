const t$1 = globalThis, e$2 = t$1.ShadowRoot && (void 0 === t$1.ShadyCSS || t$1.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, s$2 = /* @__PURE__ */ Symbol(), o$3 = /* @__PURE__ */ new WeakMap();
let n$2 = class n {
  constructor(t2, e2, o2) {
    if (this._$cssResult$ = true, o2 !== s$2) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t2, this.t = e2;
  }
  get styleSheet() {
    let t2 = this.o;
    const s2 = this.t;
    if (e$2 && void 0 === t2) {
      const e2 = void 0 !== s2 && 1 === s2.length;
      e2 && (t2 = o$3.get(s2)), void 0 === t2 && ((this.o = t2 = new CSSStyleSheet()).replaceSync(this.cssText), e2 && o$3.set(s2, t2));
    }
    return t2;
  }
  toString() {
    return this.cssText;
  }
};
const r$2 = (t2) => new n$2("string" == typeof t2 ? t2 : t2 + "", void 0, s$2), S$1 = (s2, o2) => {
  if (e$2) s2.adoptedStyleSheets = o2.map((t2) => t2 instanceof CSSStyleSheet ? t2 : t2.styleSheet);
  else for (const e2 of o2) {
    const o3 = document.createElement("style"), n3 = t$1.litNonce;
    void 0 !== n3 && o3.setAttribute("nonce", n3), o3.textContent = e2.cssText, s2.appendChild(o3);
  }
}, c$2 = e$2 ? (t2) => t2 : (t2) => t2 instanceof CSSStyleSheet ? ((t3) => {
  let e2 = "";
  for (const s2 of t3.cssRules) e2 += s2.cssText;
  return r$2(e2);
})(t2) : t2;
const { is: i$2, defineProperty: e$1, getOwnPropertyDescriptor: h$1, getOwnPropertyNames: r$1, getOwnPropertySymbols: o$2, getPrototypeOf: n$1 } = Object, a$1 = globalThis, c$1 = a$1.trustedTypes, l$1 = c$1 ? c$1.emptyScript : "", p$1 = a$1.reactiveElementPolyfillSupport, d$1 = (t2, s2) => t2, u$1 = { toAttribute(t2, s2) {
  switch (s2) {
    case Boolean:
      t2 = t2 ? l$1 : null;
      break;
    case Object:
    case Array:
      t2 = null == t2 ? t2 : JSON.stringify(t2);
  }
  return t2;
}, fromAttribute(t2, s2) {
  let i2 = t2;
  switch (s2) {
    case Boolean:
      i2 = null !== t2;
      break;
    case Number:
      i2 = null === t2 ? null : Number(t2);
      break;
    case Object:
    case Array:
      try {
        i2 = JSON.parse(t2);
      } catch (t3) {
        i2 = null;
      }
  }
  return i2;
} }, f$1 = (t2, s2) => !i$2(t2, s2), b$1 = { attribute: true, type: String, converter: u$1, reflect: false, useDefault: false, hasChanged: f$1 };
Symbol.metadata ??= /* @__PURE__ */ Symbol("metadata"), a$1.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let y$1 = class y extends HTMLElement {
  static addInitializer(t2) {
    this._$Ei(), (this.l ??= []).push(t2);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t2, s2 = b$1) {
    if (s2.state && (s2.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t2) && ((s2 = Object.create(s2)).wrapped = true), this.elementProperties.set(t2, s2), !s2.noAccessor) {
      const i2 = /* @__PURE__ */ Symbol(), h2 = this.getPropertyDescriptor(t2, i2, s2);
      void 0 !== h2 && e$1(this.prototype, t2, h2);
    }
  }
  static getPropertyDescriptor(t2, s2, i2) {
    const { get: e2, set: r2 } = h$1(this.prototype, t2) ?? { get() {
      return this[s2];
    }, set(t3) {
      this[s2] = t3;
    } };
    return { get: e2, set(s3) {
      const h2 = e2?.call(this);
      r2?.call(this, s3), this.requestUpdate(t2, h2, i2);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t2) {
    return this.elementProperties.get(t2) ?? b$1;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d$1("elementProperties"))) return;
    const t2 = n$1(this);
    t2.finalize(), void 0 !== t2.l && (this.l = [...t2.l]), this.elementProperties = new Map(t2.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d$1("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d$1("properties"))) {
      const t3 = this.properties, s2 = [...r$1(t3), ...o$2(t3)];
      for (const i2 of s2) this.createProperty(i2, t3[i2]);
    }
    const t2 = this[Symbol.metadata];
    if (null !== t2) {
      const s2 = litPropertyMetadata.get(t2);
      if (void 0 !== s2) for (const [t3, i2] of s2) this.elementProperties.set(t3, i2);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t3, s2] of this.elementProperties) {
      const i2 = this._$Eu(t3, s2);
      void 0 !== i2 && this._$Eh.set(i2, t3);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s2) {
    const i2 = [];
    if (Array.isArray(s2)) {
      const e2 = new Set(s2.flat(1 / 0).reverse());
      for (const s3 of e2) i2.unshift(c$2(s3));
    } else void 0 !== s2 && i2.push(c$2(s2));
    return i2;
  }
  static _$Eu(t2, s2) {
    const i2 = s2.attribute;
    return false === i2 ? void 0 : "string" == typeof i2 ? i2 : "string" == typeof t2 ? t2.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t2) => this.enableUpdating = t2), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t2) => t2(this));
  }
  addController(t2) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t2), void 0 !== this.renderRoot && this.isConnected && t2.hostConnected?.();
  }
  removeController(t2) {
    this._$EO?.delete(t2);
  }
  _$E_() {
    const t2 = /* @__PURE__ */ new Map(), s2 = this.constructor.elementProperties;
    for (const i2 of s2.keys()) this.hasOwnProperty(i2) && (t2.set(i2, this[i2]), delete this[i2]);
    t2.size > 0 && (this._$Ep = t2);
  }
  createRenderRoot() {
    const t2 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S$1(t2, this.constructor.elementStyles), t2;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(true), this._$EO?.forEach((t2) => t2.hostConnected?.());
  }
  enableUpdating(t2) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t2) => t2.hostDisconnected?.());
  }
  attributeChangedCallback(t2, s2, i2) {
    this._$AK(t2, i2);
  }
  _$ET(t2, s2) {
    const i2 = this.constructor.elementProperties.get(t2), e2 = this.constructor._$Eu(t2, i2);
    if (void 0 !== e2 && true === i2.reflect) {
      const h2 = (void 0 !== i2.converter?.toAttribute ? i2.converter : u$1).toAttribute(s2, i2.type);
      this._$Em = t2, null == h2 ? this.removeAttribute(e2) : this.setAttribute(e2, h2), this._$Em = null;
    }
  }
  _$AK(t2, s2) {
    const i2 = this.constructor, e2 = i2._$Eh.get(t2);
    if (void 0 !== e2 && this._$Em !== e2) {
      const t3 = i2.getPropertyOptions(e2), h2 = "function" == typeof t3.converter ? { fromAttribute: t3.converter } : void 0 !== t3.converter?.fromAttribute ? t3.converter : u$1;
      this._$Em = e2;
      const r2 = h2.fromAttribute(s2, t3.type);
      this[e2] = r2 ?? this._$Ej?.get(e2) ?? r2, this._$Em = null;
    }
  }
  requestUpdate(t2, s2, i2, e2 = false, h2) {
    if (void 0 !== t2) {
      const r2 = this.constructor;
      if (false === e2 && (h2 = this[t2]), i2 ??= r2.getPropertyOptions(t2), !((i2.hasChanged ?? f$1)(h2, s2) || i2.useDefault && i2.reflect && h2 === this._$Ej?.get(t2) && !this.hasAttribute(r2._$Eu(t2, i2)))) return;
      this.C(t2, s2, i2);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t2, s2, { useDefault: i2, reflect: e2, wrapped: h2 }, r2) {
    i2 && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t2) && (this._$Ej.set(t2, r2 ?? s2 ?? this[t2]), true !== h2 || void 0 !== r2) || (this._$AL.has(t2) || (this.hasUpdated || i2 || (s2 = void 0), this._$AL.set(t2, s2)), true === e2 && this._$Em !== t2 && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t2));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t3) {
      Promise.reject(t3);
    }
    const t2 = this.scheduleUpdate();
    return null != t2 && await t2, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [t4, s3] of this._$Ep) this[t4] = s3;
        this._$Ep = void 0;
      }
      const t3 = this.constructor.elementProperties;
      if (t3.size > 0) for (const [s3, i2] of t3) {
        const { wrapped: t4 } = i2, e2 = this[s3];
        true !== t4 || this._$AL.has(s3) || void 0 === e2 || this.C(s3, void 0, i2, e2);
      }
    }
    let t2 = false;
    const s2 = this._$AL;
    try {
      t2 = this.shouldUpdate(s2), t2 ? (this.willUpdate(s2), this._$EO?.forEach((t3) => t3.hostUpdate?.()), this.update(s2)) : this._$EM();
    } catch (s3) {
      throw t2 = false, this._$EM(), s3;
    }
    t2 && this._$AE(s2);
  }
  willUpdate(t2) {
  }
  _$AE(t2) {
    this._$EO?.forEach((t3) => t3.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t2)), this.updated(t2);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t2) {
    return true;
  }
  update(t2) {
    this._$Eq &&= this._$Eq.forEach((t3) => this._$ET(t3, this[t3])), this._$EM();
  }
  updated(t2) {
  }
  firstUpdated(t2) {
  }
};
y$1.elementStyles = [], y$1.shadowRootOptions = { mode: "open" }, y$1[d$1("elementProperties")] = /* @__PURE__ */ new Map(), y$1[d$1("finalized")] = /* @__PURE__ */ new Map(), p$1?.({ ReactiveElement: y$1 }), (a$1.reactiveElementVersions ??= []).push("2.1.2");
const t = globalThis, i$1 = (t2) => t2, s$1 = t.trustedTypes, e = s$1 ? s$1.createPolicy("lit-html", { createHTML: (t2) => t2 }) : void 0, h = "$lit$", o$1 = `lit$${Math.random().toFixed(9).slice(2)}$`, n2 = "?" + o$1, r = `<${n2}>`, l = document, c = () => l.createComment(""), a = (t2) => null === t2 || "object" != typeof t2 && "function" != typeof t2, u = Array.isArray, d = (t2) => u(t2) || "function" == typeof t2?.[Symbol.iterator], f = "[ 	\n\f\r]", v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, _ = /-->/g, m = />/g, p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), g = /'/g, $ = /"/g, y2 = /^(?:script|style|textarea|title)$/i, x = (t2) => (i2, ...s2) => ({ _$litType$: t2, strings: i2, values: s2 }), b = x(1), E = /* @__PURE__ */ Symbol.for("lit-noChange"), A = /* @__PURE__ */ Symbol.for("lit-nothing"), C = /* @__PURE__ */ new WeakMap(), P = l.createTreeWalker(l, 129);
function V(t2, i2) {
  if (!u(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e ? e.createHTML(i2) : i2;
}
const N = (t2, i2) => {
  const s2 = t2.length - 1, e2 = [];
  let n3, l2 = 2 === i2 ? "<svg>" : 3 === i2 ? "<math>" : "", c2 = v;
  for (let i3 = 0; i3 < s2; i3++) {
    const s3 = t2[i3];
    let a2, u2, d2 = -1, f2 = 0;
    for (; f2 < s3.length && (c2.lastIndex = f2, u2 = c2.exec(s3), null !== u2); ) f2 = c2.lastIndex, c2 === v ? "!--" === u2[1] ? c2 = _ : void 0 !== u2[1] ? c2 = m : void 0 !== u2[2] ? (y2.test(u2[2]) && (n3 = RegExp("</" + u2[2], "g")), c2 = p) : void 0 !== u2[3] && (c2 = p) : c2 === p ? ">" === u2[0] ? (c2 = n3 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c2.lastIndex - u2[2].length, a2 = u2[1], c2 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c2 === $ || c2 === g ? c2 = p : c2 === _ || c2 === m ? c2 = v : (c2 = p, n3 = void 0);
    const x2 = c2 === p && t2[i3 + 1].startsWith("/>") ? " " : "";
    l2 += c2 === v ? s3 + r : d2 >= 0 ? (e2.push(a2), s3.slice(0, d2) + h + s3.slice(d2) + o$1 + x2) : s3 + o$1 + (-2 === d2 ? i3 : x2);
  }
  return [V(t2, l2 + (t2[s2] || "<?>") + (2 === i2 ? "</svg>" : 3 === i2 ? "</math>" : "")), e2];
};
class S {
  constructor({ strings: t2, _$litType$: i2 }, e2) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t2.length - 1, d2 = this.parts, [f2, v2] = N(t2, i2);
    if (this.el = S.createElement(f2, e2), P.currentNode = this.el.content, 2 === i2 || 3 === i2) {
      const t3 = this.el.content.firstChild;
      t3.replaceWith(...t3.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t3 of r2.getAttributeNames()) if (t3.endsWith(h)) {
          const i3 = v2[a2++], s2 = r2.getAttribute(t3).split(o$1), e3 = /([.?@])?(.*)/.exec(i3);
          d2.push({ type: 1, index: l2, name: e3[2], strings: s2, ctor: "." === e3[1] ? I : "?" === e3[1] ? L : "@" === e3[1] ? z : H }), r2.removeAttribute(t3);
        } else t3.startsWith(o$1) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t3));
        if (y2.test(r2.tagName)) {
          const t3 = r2.textContent.split(o$1), i3 = t3.length - 1;
          if (i3 > 0) {
            r2.textContent = s$1 ? s$1.emptyScript : "";
            for (let s2 = 0; s2 < i3; s2++) r2.append(t3[s2], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t3[i3], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n2) d2.push({ type: 2, index: l2 });
      else {
        let t3 = -1;
        for (; -1 !== (t3 = r2.data.indexOf(o$1, t3 + 1)); ) d2.push({ type: 7, index: l2 }), t3 += o$1.length - 1;
      }
      l2++;
    }
  }
  static createElement(t2, i2) {
    const s2 = l.createElement("template");
    return s2.innerHTML = t2, s2;
  }
}
function M(t2, i2, s2 = t2, e2) {
  if (i2 === E) return i2;
  let h2 = void 0 !== e2 ? s2._$Co?.[e2] : s2._$Cl;
  const o2 = a(i2) ? void 0 : i2._$litDirective$;
  return h2?.constructor !== o2 && (h2?._$AO?.(false), void 0 === o2 ? h2 = void 0 : (h2 = new o2(t2), h2._$AT(t2, s2, e2)), void 0 !== e2 ? (s2._$Co ??= [])[e2] = h2 : s2._$Cl = h2), void 0 !== h2 && (i2 = M(t2, h2._$AS(t2, i2.values), h2, e2)), i2;
}
class R {
  constructor(t2, i2) {
    this._$AV = [], this._$AN = void 0, this._$AD = t2, this._$AM = i2;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t2) {
    const { el: { content: i2 }, parts: s2 } = this._$AD, e2 = (t2?.creationScope ?? l).importNode(i2, true);
    P.currentNode = e2;
    let h2 = P.nextNode(), o2 = 0, n3 = 0, r2 = s2[0];
    for (; void 0 !== r2; ) {
      if (o2 === r2.index) {
        let i3;
        2 === r2.type ? i3 = new k(h2, h2.nextSibling, this, t2) : 1 === r2.type ? i3 = new r2.ctor(h2, r2.name, r2.strings, this, t2) : 6 === r2.type && (i3 = new Z(h2, this, t2)), this._$AV.push(i3), r2 = s2[++n3];
      }
      o2 !== r2?.index && (h2 = P.nextNode(), o2++);
    }
    return P.currentNode = l, e2;
  }
  p(t2) {
    let i2 = 0;
    for (const s2 of this._$AV) void 0 !== s2 && (void 0 !== s2.strings ? (s2._$AI(t2, s2, i2), i2 += s2.strings.length - 2) : s2._$AI(t2[i2])), i2++;
  }
}
class k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t2, i2, s2, e2) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t2, this._$AB = i2, this._$AM = s2, this.options = e2, this._$Cv = e2?.isConnected ?? true;
  }
  get parentNode() {
    let t2 = this._$AA.parentNode;
    const i2 = this._$AM;
    return void 0 !== i2 && 11 === t2?.nodeType && (t2 = i2.parentNode), t2;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t2, i2 = this) {
    t2 = M(this, t2, i2), a(t2) ? t2 === A || null == t2 || "" === t2 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t2 !== this._$AH && t2 !== E && this._(t2) : void 0 !== t2._$litType$ ? this.$(t2) : void 0 !== t2.nodeType ? this.T(t2) : d(t2) ? this.k(t2) : this._(t2);
  }
  O(t2) {
    return this._$AA.parentNode.insertBefore(t2, this._$AB);
  }
  T(t2) {
    this._$AH !== t2 && (this._$AR(), this._$AH = this.O(t2));
  }
  _(t2) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t2 : this.T(l.createTextNode(t2)), this._$AH = t2;
  }
  $(t2) {
    const { values: i2, _$litType$: s2 } = t2, e2 = "number" == typeof s2 ? this._$AC(t2) : (void 0 === s2.el && (s2.el = S.createElement(V(s2.h, s2.h[0]), this.options)), s2);
    if (this._$AH?._$AD === e2) this._$AH.p(i2);
    else {
      const t3 = new R(e2, this), s3 = t3.u(this.options);
      t3.p(i2), this.T(s3), this._$AH = t3;
    }
  }
  _$AC(t2) {
    let i2 = C.get(t2.strings);
    return void 0 === i2 && C.set(t2.strings, i2 = new S(t2)), i2;
  }
  k(t2) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i2 = this._$AH;
    let s2, e2 = 0;
    for (const h2 of t2) e2 === i2.length ? i2.push(s2 = new k(this.O(c()), this.O(c()), this, this.options)) : s2 = i2[e2], s2._$AI(h2), e2++;
    e2 < i2.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i2.length = e2);
  }
  _$AR(t2 = this._$AA.nextSibling, s2) {
    for (this._$AP?.(false, true, s2); t2 !== this._$AB; ) {
      const s3 = i$1(t2).nextSibling;
      i$1(t2).remove(), t2 = s3;
    }
  }
  setConnected(t2) {
    void 0 === this._$AM && (this._$Cv = t2, this._$AP?.(t2));
  }
}
class H {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t2, i2, s2, e2, h2) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t2, this.name = i2, this._$AM = e2, this.options = h2, s2.length > 2 || "" !== s2[0] || "" !== s2[1] ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = A;
  }
  _$AI(t2, i2 = this, s2, e2) {
    const h2 = this.strings;
    let o2 = false;
    if (void 0 === h2) t2 = M(this, t2, i2, 0), o2 = !a(t2) || t2 !== this._$AH && t2 !== E, o2 && (this._$AH = t2);
    else {
      const e3 = t2;
      let n3, r2;
      for (t2 = h2[0], n3 = 0; n3 < h2.length - 1; n3++) r2 = M(this, e3[s2 + n3], i2, n3), r2 === E && (r2 = this._$AH[n3]), o2 ||= !a(r2) || r2 !== this._$AH[n3], r2 === A ? t2 = A : t2 !== A && (t2 += (r2 ?? "") + h2[n3 + 1]), this._$AH[n3] = r2;
    }
    o2 && !e2 && this.j(t2);
  }
  j(t2) {
    t2 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 ?? "");
  }
}
class I extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t2) {
    this.element[this.name] = t2 === A ? void 0 : t2;
  }
}
class L extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t2) {
    this.element.toggleAttribute(this.name, !!t2 && t2 !== A);
  }
}
class z extends H {
  constructor(t2, i2, s2, e2, h2) {
    super(t2, i2, s2, e2, h2), this.type = 5;
  }
  _$AI(t2, i2 = this) {
    if ((t2 = M(this, t2, i2, 0) ?? A) === E) return;
    const s2 = this._$AH, e2 = t2 === A && s2 !== A || t2.capture !== s2.capture || t2.once !== s2.once || t2.passive !== s2.passive, h2 = t2 !== A && (s2 === A || e2);
    e2 && this.element.removeEventListener(this.name, this, s2), h2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
  }
  handleEvent(t2) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t2) : this._$AH.handleEvent(t2);
  }
}
class Z {
  constructor(t2, i2, s2) {
    this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = i2, this.options = s2;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t2) {
    M(this, t2);
  }
}
const B = t.litHtmlPolyfillSupport;
B?.(S, k), (t.litHtmlVersions ??= []).push("3.3.2");
const D = (t2, i2, s2) => {
  const e2 = s2?.renderBefore ?? i2;
  let h2 = e2._$litPart$;
  if (void 0 === h2) {
    const t3 = s2?.renderBefore ?? null;
    e2._$litPart$ = h2 = new k(i2.insertBefore(c(), t3), t3, void 0, s2 ?? {});
  }
  return h2._$AI(t2), h2;
};
const s = globalThis;
class i extends y$1 {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t2 = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t2.firstChild, t2;
  }
  update(t2) {
    const r2 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t2), this._$Do = D(r2, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
}
i._$litElement$ = true, i["finalized"] = true, s.litElementHydrateSupport?.({ LitElement: i });
const o = s.litElementPolyfillSupport;
o?.({ LitElement: i });
(s.litElementVersions ??= []).push("4.2.2");
let snapshot = null;
let unsubscribeSnapshot;
let unsubscribeWindowState;
let composerValue = "";
let statusMessage = "";
let statusTimer;
let isBusy = false;
let sidebarOpen = true;
let detailsOpen = false;
let workspaceSwitcherOpen = false;
let composerMenuOpen = null;
let windowState = {
  isMaximized: false
};
let providerDraft = {
  label: "",
  family: "openai",
  baseUrl: "",
  apiKey: ""
};
function getRoot() {
  const root = document.getElementById("app");
  if (!root) {
    throw new Error("App root not found");
  }
  return root;
}
function truncate(value, maxLength) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  if (maxLength <= 3) {
    return normalized.slice(0, maxLength);
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}
function basenamePath(value) {
  if (!value) {
    return "未选择工作区";
  }
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
}
function formatTimestamp(value) {
  if (!value) {
    return "现在";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function formatRelativeTime(value) {
  if (!value) {
    return "刚刚";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const deltaMs = Date.now() - date.getTime();
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / 6e4));
  if (deltaMinutes < 60) {
    return `${deltaMinutes} 分钟前`;
  }
  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours} 小时前`;
  }
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) {
    return `${deltaDays} 天前`;
  }
  return formatTimestamp(value);
}
function setStatus(message) {
  statusMessage = message;
  if (statusTimer) {
    window.clearTimeout(statusTimer);
  }
  statusTimer = window.setTimeout(() => {
    statusMessage = "";
    renderApp();
  }, 3600);
  renderApp();
}
function requestRender() {
  renderApp();
}
function activeSession() {
  return snapshot?.activeSession;
}
function activeSessionRecord() {
  return activeSession()?.record;
}
function activeRuntimeState() {
  return activeSession()?.runtimeState;
}
function activeProfile() {
  const currentSnapshot = snapshot;
  if (!currentSnapshot?.activeSelection.profileId) {
    return void 0;
  }
  return currentSnapshot.providerProfiles.find(
    (profile) => profile.id === currentSnapshot.activeSelection.profileId
  );
}
function activeModelName() {
  const profile = activeProfile();
  const modelId = snapshot?.activeSelection.modelId;
  return profile?.models.find((model) => model.id === modelId)?.name ?? modelId;
}
function workspaceSummaries() {
  const currentWorkspacePath = snapshot?.currentWorkspacePath;
  const paths = Array.from(
    new Set([currentWorkspacePath, ...snapshot?.recentWorkspaces ?? []].filter((value) => Boolean(value)))
  );
  return paths.map((workspacePath) => {
    const sessions = (snapshot?.sessions ?? []).filter((session) => session.workspacePath === workspacePath).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    const latestSession = sessions[0];
    return {
      path: workspacePath,
      name: basenamePath(workspacePath),
      isCurrent: workspacePath === currentWorkspacePath,
      sessionCount: sessions.length,
      lastUpdated: latestSession?.updatedAt,
      lastTitle: latestSession?.title,
      providerLabel: latestSession?.providerLabel
    };
  });
}
function sessionStateLabel(session) {
  switch (session?.state) {
    case "active":
      return "当前";
    case "ready":
      return "就绪";
    case "recent":
      return "最近";
    default:
      return "会话";
  }
}
function providerValidationLabel(profile) {
  switch (profile.lastValidationStatus) {
    case "ok":
      return "已验证";
    case "error":
      return "异常";
    default:
      return "未校验";
  }
}
function providerValidationTone(profile) {
  switch (profile.lastValidationStatus) {
    case "ok":
      return "is-ready";
    case "error":
      return "is-danger";
    default:
      return "is-muted";
  }
}
function messageKindLabel(message) {
  switch (message.kind) {
    case "reasoning":
      return "思考";
    case "tool":
      return "工具";
    case "status":
      return "状态";
    default:
      if (message.role === "user") {
        return "你";
      }
      if (message.role === "assistant") {
        return "WEPS";
      }
      return "系统";
  }
}
function messageAuthorLabel(message) {
  if (message.kind === "reasoning") {
    return "WEPS · 思考";
  }
  if (message.kind === "tool") {
    return "工具输出";
  }
  if (message.kind === "status") {
    return "系统状态";
  }
  return message.role === "user" ? "你" : message.role === "assistant" ? "WEPS" : "系统";
}
function messageAvatarLabel(message) {
  if (message.kind === "tool") {
    return "T";
  }
  if (message.kind === "status") {
    return "S";
  }
  return message.role === "user" ? "你" : "W";
}
function messageBubbleTone(message) {
  if (message.kind === "reasoning") {
    return "message-bubble--reasoning";
  }
  if (message.kind === "tool") {
    return "message-bubble--tool";
  }
  if (message.kind === "status" || message.role === "system") {
    return "message-bubble--system";
  }
  if (message.role === "user") {
    return "message-bubble--user";
  }
  return "message-bubble--assistant";
}
function openDetails() {
  detailsOpen = true;
  workspaceSwitcherOpen = false;
  composerMenuOpen = null;
  requestRender();
}
function closeDetails() {
  detailsOpen = false;
  requestRender();
}
function openWorkspaceSwitcher() {
  workspaceSwitcherOpen = true;
  detailsOpen = false;
  composerMenuOpen = null;
  requestRender();
}
function closeWorkspaceSwitcher() {
  workspaceSwitcherOpen = false;
  requestRender();
}
function toggleComposerMenu(menu) {
  composerMenuOpen = composerMenuOpen === menu ? null : menu;
  requestRender();
}
function closeComposerMenu() {
  if (!composerMenuOpen) {
    return;
  }
  composerMenuOpen = null;
  requestRender();
}
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  requestRender();
}
async function minimizeWindow() {
  await window.wepsDesktop.minimizeWindow();
}
async function toggleMaximizeWindow() {
  windowState = await window.wepsDesktop.toggleMaximizeWindow();
  requestRender();
}
async function closeWindow() {
  await window.wepsDesktop.closeWindow();
}
async function runTask(task) {
  if (isBusy) {
    return;
  }
  isBusy = true;
  requestRender();
  try {
    await task();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  } finally {
    isBusy = false;
    requestRender();
  }
}
async function activateWorkspace(workspacePath) {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
    detailsOpen = false;
    workspaceSwitcherOpen = false;
    setStatus(`已切换到工作区：${basenamePath(workspacePath)}`);
  });
}
async function chooseWorkspace() {
  await runTask(async () => {
    const workspacePath = await window.wepsDesktop.chooseWorkspaceDirectory();
    if (!workspacePath) {
      return;
    }
    snapshot = await window.wepsDesktop.activateWorkspace(workspacePath);
    detailsOpen = false;
    workspaceSwitcherOpen = false;
    setStatus(`已选择工作区：${basenamePath(workspacePath)}`);
  });
}
async function activateWorkspaceFromSwitcher(workspacePath) {
  closeWorkspaceSwitcher();
  await activateWorkspace(workspacePath);
}
async function chooseWorkspaceFromSwitcher() {
  closeWorkspaceSwitcher();
  await chooseWorkspace();
}
async function closeCurrentWorkspace() {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.closeWorkspace();
    workspaceSwitcherOpen = false;
    detailsOpen = false;
    composerMenuOpen = null;
    setStatus("已关闭当前工作区。");
  });
}
async function openSession(sessionId) {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.openSession(sessionId);
    composerMenuOpen = null;
    setStatus("会话已打开。");
  });
}
async function createSession() {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.createSession();
    composerMenuOpen = null;
    setStatus("已创建新会话。");
  });
}
async function archiveSession(sessionId) {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.archiveSession(sessionId);
    setStatus("线程已归档。");
  });
}
async function deleteSession(sessionId) {
  const confirmed = window.confirm("确认永久删除这个线程吗？该操作会同时移除对应的会话记录。");
  if (!confirmed) {
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.deleteSession(sessionId);
    setStatus("线程已删除。");
  });
}
async function sendPrompt() {
  const normalized = composerValue.trim();
  if (!normalized) {
    return;
  }
  await runTask(async () => {
    let currentSession = activeSession();
    if (!currentSession) {
      snapshot = await window.wepsDesktop.createSession();
      currentSession = activeSession();
    }
    if (!currentSession) {
      throw new Error("当前没有可用会话。");
    }
    const text = normalized;
    composerValue = "";
    requestRender();
    await window.wepsDesktop.sendPrompt(currentSession.record.id, text);
  });
}
async function abortSession() {
  const currentSession = activeSession();
  if (!currentSession) {
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.abortSession(currentSession.record.id);
    setStatus("已中断当前运行。");
  });
}
async function resolveApproval(decision) {
  const request = activeSession()?.pendingApproval;
  if (!request) {
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.resolveApproval(request.id, decision);
    setStatus(`已记录审批结果：${decision}`);
  });
}
async function setProfileSelection(profileId) {
  await runTask(async () => {
    snapshot = await window.wepsDesktop.setActiveSelection(profileId);
    const profile = snapshot.providerProfiles.find((entry) => entry.id === profileId);
    setStatus(profile ? `当前 Provider：${profile.label}` : "已更新 Provider 选择。");
  });
}
async function selectProfileFromComposer(profileId) {
  composerMenuOpen = null;
  requestRender();
  await setProfileSelection(profileId);
}
async function setModelSelection(modelId) {
  const profileId = snapshot?.activeSelection.profileId;
  if (!profileId) {
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.setActiveSelection(profileId, modelId);
    setStatus(`当前模型：${modelId}`);
  });
}
async function selectModelFromComposer(modelId) {
  composerMenuOpen = null;
  requestRender();
  await setModelSelection(modelId);
}
async function refreshActiveProfile() {
  const profileId = snapshot?.activeSelection.profileId;
  if (!profileId) {
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.refreshProviderModels(profileId);
    setStatus("已刷新当前 Provider 的模型列表。");
  });
}
async function createProviderProfile() {
  if (!providerDraft.label.trim() || !providerDraft.baseUrl.trim() || !providerDraft.apiKey.trim()) {
    setStatus("请填写 Provider 名称、Base URL 和 API Key。");
    return;
  }
  await runTask(async () => {
    snapshot = await window.wepsDesktop.createProviderProfile({
      ...providerDraft,
      label: providerDraft.label.trim(),
      baseUrl: providerDraft.baseUrl.trim(),
      apiKey: providerDraft.apiKey.trim()
    });
    providerDraft = {
      label: "",
      family: providerDraft.family,
      baseUrl: "",
      apiKey: ""
    };
    setStatus("已创建 Provider，并同步到 CLI 共享目录。");
  });
}
function renderWindowControls() {
  return b`
		<div class="window-controls">
			<button class="window-control" @click=${() => void minimizeWindow()} aria-label="最小化"><span></span></button>
			<button class="window-control" @click=${() => void toggleMaximizeWindow()} aria-label="最大化或还原">
				${windowState.isMaximized ? b`<span class="window-control__restore"></span>` : b`<span class="window-control__maximize"></span>`}
			</button>
			<button class="window-control window-control--close" @click=${() => void closeWindow()} aria-label="关闭">
				<span class="window-control__close"></span>
			</button>
		</div>
	`;
}
function renderTopbar() {
  const title = activeSessionRecord()?.title || basenamePath(snapshot?.currentWorkspacePath);
  return b`
		<header class="topbar">
			<div class="topbar__drag">
				<div class="topbar__left">
					<button class="icon-button" ?disabled=${isBusy} @click=${() => toggleSidebar()} aria-label="切换侧栏">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 5.75h16.5M3.75 12h16.5M3.75 18.25h10.5" />
						</svg>
					</button>
					<span class="topbar__app">WEPS</span>
				</div>
				<div class="topbar__title">
					<span class="topbar__eyebrow">Shared with WEPS CLI</span>
					<strong>${truncate(title, 48)}</strong>
				</div>
			</div>

			<div class="topbar__actions">
				${renderWindowControls()}
			</div>
		</header>
	`;
}
function renderLauncherTopbar() {
  return b`
		<header class="topbar topbar--launcher">
			<div class="topbar__drag">
				<div class="topbar__left">
					<span class="topbar__app">WEPS Desktop</span>
				</div>
			</div>
			<div class="topbar__actions">${renderWindowControls()}</div>
		</header>
	`;
}
function renderLoadingState() {
  return b`
		<div class="launcher-shell">
			${renderLauncherTopbar()}
			<div class="launcher-body launcher-body--loading">
				<div class="loading-panel">
					<div class="loading-panel__spinner"></div>
					<div class="loading-panel__copy">
						<p class="eyebrow">WEPS Desktop</p>
						<h1>正在加载桌面工作台...</h1>
						<p>读取共享的 Provider、Session 和工作区索引。</p>
					</div>
				</div>
			</div>
		</div>
	`;
}
function renderWorkspaceLauncher() {
  const recentWorkspaces = snapshot?.recentWorkspaces ?? [];
  return b`
		<div class="launcher-shell">
			${renderLauncherTopbar()}
			<div class="launcher-body">
				<section class="launcher-hero">
					<div class="launcher-hero__glow launcher-hero__glow--primary"></div>
					<div class="launcher-hero__glow launcher-hero__glow--secondary"></div>
					<div class="launcher-hero__content">
						<p class="eyebrow">WEPS Desktop</p>
						<h1>继续你的 CLI 工作流，换一种更顺手的桌面交互。</h1>
						<p>
							桌面端不会重造数据层，只把会话、Provider 和工作区切换整理成更接近日常应用的窗口体验。
						</p>
						<div class="launcher-hero__actions">
							<button class="button button--primary" ?disabled=${isBusy} @click=${() => void chooseWorkspace()}>
								打开工作区
							</button>
						</div>
					</div>
				</section>

				<aside class="launcher-aside">
					<section class="panel-card">
						<div class="section-head">
							<h2>共享状态</h2>
							<span>CLI</span>
						</div>
						<div class="metric-grid">
							<div class="metric">
								<span>Provider</span>
								<strong>${snapshot?.providerProfiles.length ?? 0}</strong>
							</div>
							<div class="metric">
								<span>会话</span>
								<strong>${snapshot?.sessions.length ?? 0}</strong>
							</div>
						</div>
					</section>

					<section class="panel-card">
						<div class="section-head">
							<h2>最近工作区</h2>
							<span>${recentWorkspaces.length}</span>
						</div>
						<div class="compact-list">
							${recentWorkspaces.length > 0 ? recentWorkspaces.map(
    (workspacePath) => b`
											<button
												class="compact-list__item"
												?disabled=${isBusy}
												@click=${() => {
      void activateWorkspace(workspacePath);
    }}
											>
												<strong>${basenamePath(workspacePath)}</strong>
												<small>${truncate(workspacePath, 72)}</small>
											</button>
										`
  ) : b`<p class="panel-empty">还没有工作区记录。选择一个目录后，这里会出现快捷入口。</p>`}
						</div>
					</section>
				</aside>
			</div>
		</div>
	`;
}
function renderSidebar() {
  const currentWorkspacePath = snapshot?.currentWorkspacePath;
  const profile = activeProfile();
  return b`
		<aside class="sidebar">
			<div class="sidebar__section sidebar__section--workspace">
				<div class="sidebar-brand">
					<div class="sidebar-brand__mark">W</div>
					<div class="sidebar-brand__copy">
						<strong>WEPS Desktop</strong>
						<small>${basenamePath(currentWorkspacePath)}</small>
					</div>
				</div>
				<div class="sidebar__meta-line">
					<span>${profile?.label ?? "未配置 Provider"}</span>
					<span>${snapshot?.sessions.length ?? 0} 个线程</span>
				</div>
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => void createSession()}>
					新建线程
				</button>
			</div>

			<div class="sidebar__section sidebar__section--sessions">
				<div class="section-head">
					<h3>线程</h3>
					<span>${basenamePath(currentWorkspacePath)}</span>
				</div>
				<div class="session-nav">
					${snapshot && snapshot.sessions.length > 0 ? snapshot.sessions.map((session) => renderSessionNavItem(session)) : b`<p class="panel-empty">当前工作区还没有线程，先新建一个或直接在底部输入。</p>`}
				</div>
			</div>

			<div class="sidebar__section sidebar__section--footer">
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => openWorkspaceSwitcher()}>
					切换工作区
				</button>
				<button class="button button--subtle button--full" ?disabled=${isBusy} @click=${() => openDetails()}>
					打开设置
				</button>
			</div>
		</aside>
	`;
}
function renderSessionNavItem(session) {
  const isActive = activeSessionRecord()?.id === session.id;
  return b`
		<div
			class="session-nav__item ${isActive ? "session-nav__item--active" : ""}"
			role="button"
			tabindex=${isBusy ? -1 : 0}
			@click=${() => {
    if (isBusy) {
      return;
    }
    void openSession(session.id);
  }}
			@keydown=${(event) => {
    if (isBusy) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openSession(session.id);
    }
  }}
		>
			<div class="session-nav__content">
				<div class="session-nav__titleline">
					<span class="session-nav__title">${truncate(session.title || "未命名线程", 30)}</span>
					<div class="session-nav__actions">
						<time>${formatRelativeTime(session.updatedAt)}</time>
						<button
							class="session-nav__action"
							title="归档线程"
							aria-label="归档线程"
							?disabled=${isBusy}
							@click=${(event) => {
    event.stopPropagation();
    void archiveSession(session.id);
  }}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 7.5h16M6.5 7.5v9.75A1.75 1.75 0 008.25 19h7.5a1.75 1.75 0 001.75-1.75V7.5M9.5 11.5h5" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 4.5h6" />
							</svg>
						</button>
						<button
							class="session-nav__action session-nav__action--danger"
							title="删除线程"
							aria-label="删除线程"
							?disabled=${isBusy}
							@click=${(event) => {
    event.stopPropagation();
    void deleteSession(session.id);
  }}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 7.5h14M9.5 7.5V5.75A.75.75 0 0110.25 5h3.5a.75.75 0 01.75.75V7.5M8 7.5v10.25A1.25 1.25 0 009.25 19h5.5A1.25 1.25 0 0016 17.75V7.5" />
								<path stroke-linecap="round" stroke-linejoin="round" d="M10 11v4.5M14 11v4.5" />
							</svg>
						</button>
					</div>
				</div>
				<div class="session-nav__summary">${truncate(session.lastPrompt || session.summary || "等待新的任务。", 56)}</div>
				<div class="session-nav__meta">
					<span>${sessionStateLabel(session)}</span>
					<span>${session.providerLabel ?? activeProfile()?.label ?? "未选 Provider"}</span>
				</div>
			</div>
		</div>
	`;
}
function renderPaneHeader() {
  const runtimeState = activeRuntimeState();
  return b`
		<header class="pane-toolbar">
			<div class="pane-toolbar__primary">
				<button class="pane-toolbar__selector" ?disabled=${isBusy} @click=${() => openDetails()}>
					${activeModelName() ?? "选择模型"}
				</button>
				<span class="pane-toolbar__meta">${activeProfile()?.label ?? "未配置 Provider"}</span>
				<span class="pane-toolbar__meta">${runtimeState?.label ?? "未启动"}</span>
			</div>

			<div class="pane-toolbar__actions">
				<button class="button button--subtle button--small" ?disabled=${isBusy} @click=${() => void createSession()}>
					新建
				</button>
				<button class="button button--subtle button--small" ?disabled=${isBusy} @click=${() => openDetails()}>
					设置
				</button>
			</div>
		</header>
	`;
}
function renderConversationEmptyState() {
  const hasProfiles = (snapshot?.providerProfiles.length ?? 0) > 0;
  return b`
		<div class="empty-state empty-state--hero">
			<div class="empty-state__mark">W</div>
			<p class="eyebrow">${hasProfiles ? "准备开始" : "需要一个 Provider"}</p>
			<h2>${activeModelName() ?? "WEPS Desktop"}</h2>
			<p>
				${hasProfiles ? `开始构建 ${basenamePath(snapshot?.currentWorkspacePath)}，可以从左侧选择线程，或直接在底部输入新的任务。` : "还没有可用的 Provider。打开设置后添加一个 OpenAI Compatible 或 Anthropic Compatible 配置。"}
			</p>
			<div class="empty-state__subline">
				<span>${activeProfile()?.label ?? "未配置 Provider"}</span>
				<span>${snapshot?.sessions.length ?? 0} 个线程</span>
			</div>
		</div>
	`;
}
function renderTranscriptSurface() {
  const session = activeSession();
  if (!session) {
    return b`<section class="conversation-surface conversation-surface--empty">${renderConversationEmptyState()}</section>`;
  }
  return b`
		<section class="conversation-surface ${session.messages.length === 0 ? "conversation-surface--empty" : ""}">
			<div class="transcript">
				${session.messages.length === 0 ? b`
							<div class="empty-state empty-state--compact">
								<div class="empty-state__mark empty-state__mark--small">W</div>
								<p class="eyebrow">线程已创建</p>
								<h2>${truncate(session.record.title || "未命名线程", 40)}</h2>
								<p>从底部输入框发出第一条任务，runtime 会自动绑定到当前工作区并继续写入共享会话目录。</p>
							</div>
						` : session.messages.map((message) => renderMessage(message))}
			</div>
		</section>
	`;
}
function renderMessage(message) {
  const isUser = message.role === "user";
  const bubbleTone = messageBubbleTone(message);
  return b`
		<article class="message-shell ${isUser ? "message-shell--user" : ""}">
			<div class="message-shell__meta ${isUser ? "message-shell__meta--user" : ""}">
				${isUser ? b`<span class="message-shell__time">${message.time}</span>` : b`
							<span class="message-avatar">${messageAvatarLabel(message)}</span>
							<div class="message-shell__authoring">
								<strong>${messageAuthorLabel(message)}</strong>
								<span>${message.time}</span>
							</div>
						`}
				${isUser ? b`<span class="message-avatar message-avatar--user">${messageAvatarLabel(message)}</span>` : b``}
			</div>
			<div class="message-bubble ${bubbleTone}">
				${message.kind && message.kind !== "default" ? b`<div class="message-bubble__eyebrow">${messageKindLabel(message)}</div>` : b``}
				<pre class="message-bubble__content">${message.content}</pre>
			</div>
		</article>
	`;
}
function renderApprovalBanner() {
  const request = activeSession()?.pendingApproval;
  if (!request) {
    return b``;
  }
  return b`
		<section class="approval-banner">
			<div class="approval-banner__header">
				<div>
					<p class="approval-banner__eyebrow">${request.riskLabel}</p>
					<h2>${request.toolName}</h2>
				</div>
				<span>${truncate(request.summary, 96)}</span>
			</div>
			<p class="approval-banner__text">${request.reason}</p>
			<pre class="approval-banner__content">${request.commandText ?? request.argsText}</pre>
			<div class="approval-banner__actions">
				<button class="button button--primary" ?disabled=${isBusy} @click=${() => void resolveApproval("allow")}>
					允许
				</button>
				<button class="button button--danger" ?disabled=${isBusy} @click=${() => void resolveApproval("reject")}>
					拒绝
				</button>
				<button class="button button--subtle" ?disabled=${isBusy} @click=${() => void resolveApproval("cancel")}>
					取消
				</button>
			</div>
		</section>
	`;
}
function renderProviderMenu() {
  const profiles = snapshot?.providerProfiles ?? [];
  if (profiles.length === 0) {
    return b`
			<div class="floating-menu">
				<div class="floating-menu__header">
					<strong>Provider</strong>
					<span>未配置</span>
				</div>
				<p class="floating-menu__empty">先在设置里添加一个 Provider。</p>
			</div>
		`;
  }
  return b`
		<div class="floating-menu">
			<div class="floating-menu__header">
				<strong>切换 Provider</strong>
				<span>${profiles.length} 个配置</span>
			</div>
			<div class="floating-menu__list">
				${profiles.map(
    (profile) => b`
						<button
							class="floating-menu__item ${snapshot?.activeSelection.profileId === profile.id ? "floating-menu__item--active" : ""}"
							?disabled=${isBusy}
							@click=${() => {
      void selectProfileFromComposer(profile.id);
    }}
						>
							<div>
								<strong>${profile.label}</strong>
								<small>${profile.family}</small>
							</div>
							<span class="pill pill--tiny ${providerValidationTone(profile)}">${providerValidationLabel(profile)}</span>
						</button>
					`
  )}
			</div>
		</div>
	`;
}
function renderModelMenu() {
  const profile = activeProfile();
  const models = profile?.models ?? [];
  if (!profile || models.length === 0) {
    return b`
			<div class="floating-menu">
				<div class="floating-menu__header">
					<strong>切换模型</strong>
					<span>不可用</span>
				</div>
				<p class="floating-menu__empty">先选择一个可用 Provider，然后刷新模型列表。</p>
			</div>
		`;
  }
  return b`
		<div class="floating-menu">
			<div class="floating-menu__header">
				<strong>切换模型</strong>
				<span>${profile.label}</span>
			</div>
			<div class="floating-menu__list">
				${models.map(
    (model) => b`
						<button
							class="floating-menu__item ${snapshot?.activeSelection.modelId === model.id ? "floating-menu__item--active" : ""}"
							?disabled=${isBusy}
							@click=${() => {
      void selectModelFromComposer(model.id);
    }}
						>
							<div>
								<strong>${model.name}</strong>
								<small>${model.id}</small>
							</div>
						</button>
					`
  )}
			</div>
		</div>
	`;
}
function renderComposer() {
  const runtimeState = activeRuntimeState();
  const canAbort = Boolean(runtimeState?.interruptible);
  return b`
		<section class="composer">
			<textarea
				class="composer__input"
				placeholder="描述你希望在当前工作区里完成的任务。"
				.value=${composerValue}
				@input=${(event) => {
    composerValue = event.target.value;
  }}
				@keydown=${(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendPrompt();
    }
  }}
			></textarea>

			<div class="composer__footer">
				<div class="composer__meta">
					<div class="composer__menu-anchor">
						<button class="composer__chip" ?disabled=${isBusy} @click=${() => toggleComposerMenu("model")}>
							${activeModelName() ?? "未选择模型"}
						</button>
						${composerMenuOpen === "model" ? renderModelMenu() : b``}
					</div>
					<div class="composer__menu-anchor">
						<button class="composer__chip" ?disabled=${isBusy} @click=${() => toggleComposerMenu("provider")}>
							${activeProfile()?.label ?? "未配置 Provider"}
						</button>
						${composerMenuOpen === "provider" ? renderProviderMenu() : b``}
					</div>
					<span class="composer__caption">${runtimeState?.detail ?? runtimeState?.label ?? "未启动 runtime"}</span>
				</div>
				<div class="composer__actions">
					<button class="button button--subtle" ?disabled=${isBusy || !canAbort} @click=${() => void abortSession()}>
						中断
					</button>
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void sendPrompt()}>
						发送
					</button>
				</div>
			</div>
			${composerMenuOpen ? b`<button class="floating-menu-backdrop" aria-label="关闭菜单" @click=${() => closeComposerMenu()}></button>` : b``}
		</section>
	`;
}
function renderWorkspacePane() {
  return b`
		<section class="workspace-pane">
			${renderPaneHeader()}
			<div class="workspace-pane__stage">
				${renderApprovalBanner()} ${renderTranscriptSurface()}
			</div>
			<div class="workspace-pane__composer">${renderComposer()}</div>
		</section>
	`;
}
function renderContextCard() {
  return b`
		<section class="panel-card">
			<div class="section-head">
				<h2>工作区上下文</h2>
				<span>${snapshot?.appContext.appVersion ?? "0.1.0"}</span>
			</div>
			<div class="field-block">
				<span class="field-block__label">当前工作区</span>
				<div class="field-code">${snapshot?.currentWorkspacePath ?? "未选择"}</div>
			</div>
			<div class="detail-list">
				<div class="detail-list__row">
					<span>Agent Dir</span>
					<span>${truncate(snapshot?.agentDir ?? "Unavailable", 34)}</span>
				</div>
				<div class="detail-list__row">
					<span>应用</span>
					<span>${snapshot?.appContext.appName ?? "WEPS Desktop"}</span>
				</div>
				<div class="detail-list__row">
					<span>平台</span>
					<span>${snapshot?.appContext.platform ?? "unknown"}</span>
				</div>
			</div>
		</section>
	`;
}
function renderProviderCard() {
  const profile = activeProfile();
  return b`
		<section class="panel-card">
			<div class="section-head">
				<h2>Provider 与模型</h2>
				<button class="button button--subtle button--small" ?disabled=${isBusy || !profile} @click=${() => void refreshActiveProfile()}>
					刷新模型
				</button>
			</div>

			<div class="form-grid">
				<label class="field-label">
					<span>当前 Provider</span>
					<select
						class="field-input"
						?disabled=${isBusy || (snapshot?.providerProfiles.length ?? 0) === 0}
						@change=${(event) => {
    const target = event.target;
    void setProfileSelection(target.value);
  }}
					>
						${(snapshot?.providerProfiles ?? []).map(
    (entry) => b`
								<option value=${entry.id} ?selected=${snapshot?.activeSelection.profileId === entry.id}>
									${entry.label}
								</option>
							`
  )}
					</select>
				</label>

				<label class="field-label">
					<span>当前模型</span>
					<select
						class="field-input"
						?disabled=${isBusy || !profile || profile.models.length === 0}
						@change=${(event) => {
    const target = event.target;
    void setModelSelection(target.value);
  }}
					>
						${profile?.models.map(
    (model) => b`
								<option value=${model.id} ?selected=${snapshot?.activeSelection.modelId === model.id}>
									${model.name}
								</option>
							`
  )}
					</select>
				</label>
			</div>

			<div class="provider-list">
				${(snapshot?.providerProfiles ?? []).length > 0 ? snapshot?.providerProfiles.map(
    (entry) => b`
								<button
									class="provider-chip ${snapshot?.activeSelection.profileId === entry.id ? "provider-chip--active" : ""}"
									?disabled=${isBusy}
									@click=${() => {
      void setProfileSelection(entry.id);
    }}
								>
									<div class="provider-chip__topline">
										<span>${entry.label}</span>
										<span class="pill pill--tiny ${providerValidationTone(entry)}">${providerValidationLabel(entry)}</span>
									</div>
									<div class="provider-chip__meta">
										<span>${entry.family}</span>
										<span>${entry.models.length} 个模型</span>
									</div>
								</button>
							`
  ) : b`<p class="panel-empty">还没有 Provider。下方创建后会自动写入 CLI 共享目录。</p>`}
			</div>
		</section>
	`;
}
function renderCreateProviderCard() {
  return b`
		<section class="panel-card">
			<div class="section-head">
				<h2>新增 Provider</h2>
				<span>共享到 CLI</span>
			</div>

			<div class="form-grid">
				<label class="field-label">
					<span>名称</span>
					<input
						class="field-input"
						.value=${providerDraft.label}
						@input=${(event) => {
    providerDraft = {
      ...providerDraft,
      label: event.target.value
    };
  }}
					/>
				</label>

				<label class="field-label">
					<span>Family</span>
					<select
						class="field-input"
						@change=${(event) => {
    providerDraft = {
      ...providerDraft,
      family: event.target.value
    };
  }}
					>
						<option value="openai" ?selected=${providerDraft.family === "openai"}>OpenAI Compatible</option>
						<option value="anthropic" ?selected=${providerDraft.family === "anthropic"}>Anthropic Compatible</option>
					</select>
				</label>

				<label class="field-label field-label--full">
					<span>Base URL</span>
					<input
						class="field-input"
						.value=${providerDraft.baseUrl}
						@input=${(event) => {
    providerDraft = {
      ...providerDraft,
      baseUrl: event.target.value
    };
  }}
					/>
				</label>

				<label class="field-label field-label--full">
					<span>API Key</span>
					<input
						class="field-input"
						type="password"
						.value=${providerDraft.apiKey}
						@input=${(event) => {
    providerDraft = {
      ...providerDraft,
      apiKey: event.target.value
    };
  }}
					/>
				</label>
			</div>

			<div class="panel-card__actions">
				<button class="button button--primary" ?disabled=${isBusy} @click=${() => void createProviderProfile()}>
					创建 Provider
				</button>
			</div>
		</section>
	`;
}
function renderRecentWorkspacesCard() {
  return b`
		<section class="panel-card">
			<div class="section-head">
				<h2>最近工作区</h2>
				<span>${snapshot?.recentWorkspaces.length ?? 0}</span>
			</div>
			<div class="compact-list">
				${(snapshot?.recentWorkspaces ?? []).length > 0 ? snapshot?.recentWorkspaces.map(
    (workspacePath) => b`
								<button
									class="compact-list__item"
									?disabled=${isBusy}
									@click=${() => {
      void activateWorkspace(workspacePath);
    }}
								>
									<strong>${basenamePath(workspacePath)}</strong>
									<small>${truncate(workspacePath, 72)}</small>
								</button>
							`
  ) : b`<p class="panel-empty">暂无最近工作区记录。</p>`}
			</div>
		</section>
	`;
}
function renderWorkspaceSwitcherOverlay() {
  if (!workspaceSwitcherOpen) {
    return b``;
  }
  const workspaces = workspaceSummaries();
  return b`
		<div class="settings-overlay settings-overlay--light" @click=${() => closeWorkspaceSwitcher()}>
			<section class="workspace-switcher" @click=${(event) => event.stopPropagation()}>
				<header class="workspace-switcher__header">
					<div>
						<p class="eyebrow">切换工作区</p>
						<h2>选择已接入目录</h2>
					</div>
					<button class="button button--subtle button--small" @click=${() => closeWorkspaceSwitcher()}>关闭</button>
				</header>

				<div class="workspace-switcher__list">
					${workspaces.length > 0 ? workspaces.map(
    (workspace) => b`
									<button
										class="workspace-row ${workspace.isCurrent ? "workspace-row--active" : ""}"
										?disabled=${isBusy || workspace.isCurrent}
										@click=${() => {
      void activateWorkspaceFromSwitcher(workspace.path);
    }}
									>
										<div class="workspace-row__copy">
											<div class="workspace-row__titleline">
												<strong>${workspace.name}</strong>
												${workspace.isCurrent ? b`<span class="pill pill--tiny is-ready">当前</span>` : b``}
											</div>
											<small>${truncate(workspace.path, 84)}</small>
											<div class="workspace-row__meta">
												<span>${workspace.sessionCount} 个线程</span>
												<span>${workspace.providerLabel ?? "未记录 Provider"}</span>
												<span>${workspace.lastUpdated ? formatRelativeTime(workspace.lastUpdated) : "暂无会话"}</span>
											</div>
											${workspace.lastTitle ? b`<p class="workspace-row__hint">${truncate(workspace.lastTitle, 56)}</p>` : b``}
										</div>
									</button>
								`
  ) : b`<p class="panel-empty">还没有已接入的工作区，先创建或选择一个文件夹。</p>`}
				</div>

				<div class="workspace-switcher__actions">
					${snapshot?.currentWorkspacePath ? b`
								<button class="button button--subtle" ?disabled=${isBusy} @click=${() => void closeCurrentWorkspace()}>
									关闭当前工作区
								</button>
							` : b``}
					<button class="button button--primary" ?disabled=${isBusy} @click=${() => void chooseWorkspaceFromSwitcher()}>
						创建或打开新工作区
					</button>
				</div>
			</section>
		</div>
	`;
}
function renderDetailsOverlay() {
  const currentWorkspacePath = snapshot?.currentWorkspacePath;
  if (!detailsOpen || !currentWorkspacePath) {
    return b``;
  }
  return b`
		<div class="settings-overlay" @click=${() => closeDetails()}>
			<section class="settings-sheet" @click=${(event) => event.stopPropagation()}>
				<header class="settings-sheet__header">
					<div>
						<p class="eyebrow">Workspace Settings</p>
						<h2>${basenamePath(currentWorkspacePath)}</h2>
					</div>
					<button class="button button--subtle button--small" @click=${() => closeDetails()}>关闭</button>
				</header>

				<div class="settings-sheet__grid">
					${renderContextCard()} ${renderProviderCard()} ${renderCreateProviderCard()} ${renderRecentWorkspacesCard()}
				</div>
			</section>
		</div>
	`;
}
function renderWorkspaceShell() {
  const shellClass = sidebarOpen ? "desktop-shell" : "desktop-shell desktop-shell--sidebar-hidden";
  return b`
		<div class=${shellClass}>
			${renderTopbar()}
			<div class="shell-body">
				${sidebarOpen ? renderSidebar() : b``}
				${renderWorkspacePane()}
			</div>
			${renderWorkspaceSwitcherOverlay()} ${renderDetailsOverlay()}
		</div>
	`;
}
function renderRootContent() {
  if (!snapshot) {
    return renderLoadingState();
  }
  if (!snapshot.currentWorkspacePath) {
    return renderWorkspaceLauncher();
  }
  return renderWorkspaceShell();
}
function renderApp() {
  const root = getRoot();
  const frameClass = windowState.isMaximized ? "app-frame app-frame--maximized" : "app-frame";
  D(
    b`
			<div class=${frameClass}>
				${renderRootContent()}
				${statusMessage ? b`<div class="toast">${statusMessage}</div>` : b``}
			</div>
		`,
    root
  );
}
async function bootstrap() {
  snapshot = await window.wepsDesktop.getSnapshot();
  windowState = await window.wepsDesktop.getWindowState();
  unsubscribeSnapshot = window.wepsDesktop.onSnapshot((nextSnapshot) => {
    snapshot = nextSnapshot;
    renderApp();
  });
  unsubscribeWindowState = window.wepsDesktop.onWindowState((nextState) => {
    windowState = nextState;
    renderApp();
  });
  renderApp();
}
void bootstrap();
window.addEventListener("beforeunload", () => {
  unsubscribeSnapshot?.();
  unsubscribeWindowState?.();
  if (statusTimer) {
    window.clearTimeout(statusTimer);
  }
});
