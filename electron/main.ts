import { app, BrowserWindow, session, ipcMain } from 'electron'
// import Store from 'electron-store'
import path from 'node:path'
import { checkUpdate } from './update'
import Logger from 'electron-log'
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.VITE_PUBLIC = app.isPackaged
  ? path.join(__dirname, '../dist')
  : path.join(__dirname, '../public')

// const store = new Store()
// Store.initRenderer() // 如果未在主进程创建实例，要在渲染层中使用时，需要进行初始化
let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  session.defaultSession.loadExtension(
    path.resolve(__dirname, '../.vue-devtools@6.5.1')
  )
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true
      // nodeIntegration:true,
      // contextIsolation:false
    }
  })
  try {
    checkUpdate(win)
  } catch (error) {
    Logger.error(error)
  }
  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
    //版本更新
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.VITE_PUBLIC, 'index.html'))
  }
  // // 打开配置页面
  // globalShortcut.register('CommandOrControl+Shift+F', () => {
  //   win?.webContents.send('openConfig')
  // })
  // //在编辑器中打开系统配置
  // globalShortcut.register('CommandOrControl+Shift+Alt+L', () => {
  //   store.openInEditor()
  // })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

/**
 * ipc通信
 */
/**打开控制台 */
ipcMain.on('openDevtools', (event: Electron.IpcMainEvent) => {
  event.sender.openDevTools()
})
