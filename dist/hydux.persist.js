!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.persist=e():(t.hydux=t.hydux||{},t.hydux.persist=e())}("undefined"!=typeof self?self:this,function(){return function(t){function e(r){if(n[r])return n[r].exports;var o=n[r]={i:r,l:!1,exports:{}};return t[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}var n={};return e.m=t,e.c=n,e.d=function(t,n,r){e.o(t,n)||Object.defineProperty(t,n,{configurable:!1,enumerable:!0,get:r})},e.n=function(t){var n=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(n,"a",n),n},e.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},e.p="",e(e.s=17)}({1:function(t,e,n){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.default={none:[],ofPromise:function(t,e,n,r){return[function(o){t(e).then(n).catch(r)}]},ofFn:function(t,e,n,r){return[function(o){try{n(t(e))}catch(t){r(t)}}]},ofSub:function(t){return[t]},batch:function(){for(var t=[],e=0;e<arguments.length;e++)t[e]=arguments[e];var n=Array.prototype.concat;return n.apply([],n.apply([],t))},map:function(t,e){return e.map(function(e){return function(n){return e(t(n))}})}}},17:function(t,e,n){"use strict";function r(t){var e,n=void 0===t?{}:t,r=n.store,i=void 0===r?localStorage:r,f=n.serialize,c=void 0===f?JSON.stringify:f,a=n.deserialize,s=void 0===a?JSON.parse:a,p=n.debounce,d=void 0===p?50:p,l=n.key,y=void 0===l?"hydux-persist":l;return function(t){return function(n){return t(o({},n,{init:function(){var t=n.init();t instanceof Array||(t=[t,u.default.none]);var e=i.getItem(y);return e&&(t[0]=s(e)),[t[0],t[1]]},onUpdate:function(t){n.onUpdate&&n.onUpdate(t),e&&clearTimeout(e);var r=function(){return i.setItem(y,c(t.nextAppState))};e=setTimeout(r,d)}}))}}}var o=this&&this.__assign||Object.assign||function(t){for(var e,n=1,r=arguments.length;n<r;n++){e=arguments[n];for(var o in e)Object.prototype.hasOwnProperty.call(e,o)&&(t[o]=e[o])}return t};Object.defineProperty(e,"__esModule",{value:!0});var u=n(1);e.default=r}})});
//# sourceMappingURL=hydux.persist.js.map