import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

// ใช้ hash mode เพื่อให้ deploy เป็น static ได้โดยไม่ต้องตั้ง rewrite ที่ Vercel
const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/c/:category', name: 'category', component: HomeView },
  { path: '/tag/:tag', name: 'tag', component: HomeView },
  { path: '/lore/:slug', name: 'article', component: HomeView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (to.name === 'article') return false
    return savedPosition || { top: 0 }
  },
})
