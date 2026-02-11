import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// import store from './store'
// src\main.ts
// import 'virtual:svg-icons-register'
// import router from './router'
const app = createApp(App)
// app.use(router)
// app.use(store)
app.mount('#app').$nextTick(() => {
  // Use contextBridge
  window.electronApi.ipcRenderer.on(
    'main-process-message',
    (_event, message) => {
      console.log(message)
    }
  )
})
