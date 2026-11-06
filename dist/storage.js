'use strict';
const GameStorage={
 key:globalThis.GamePreview?'starlight-preview-'+globalThis.GameVersion:'starlight-rpg-v1',
 read(){return localStorage.getItem(this.key);},
 write(state){localStorage.setItem(this.key,JSON.stringify(state));},
 remove(){localStorage.removeItem(this.key);}
};
