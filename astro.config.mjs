// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
// GitHub Pages ではサブパスで公開する。手元の dev と preview も同じパスにそろえる
export default defineConfig({
  site: 'https://ytani01.github.io',
  base: '/ytInvaders',
});
