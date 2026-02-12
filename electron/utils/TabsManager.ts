// electron/TabManager.ts
import { BrowserView, BrowserWindow, dialog, Session, shell } from 'electron'
import { PRELOAD_PATH } from './constant'

interface TabInfo {
  id: string
  view: BrowserView
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
}

interface DownloadItem {
  id: string
  filename: string
  path: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'failed' | 'cancelled'
  startTime: number
  endTime?: number
}

export class TabManager {
  private mainWindow: BrowserWindow
  private tabs: Map<string, TabInfo> = new Map()
  private activeTabId: string | null = null
  private readonly session: Session
  private downloads: Map<string, DownloadItem> = new Map()
  private readonly tabBarHeight = 40

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.session = mainWindow.webContents.session
    this.setupDownloadHandler()

    // 监听窗口大小变化
    mainWindow.on('resize', () => this.resize())
    mainWindow.on('maximize', () => this.resize())
    mainWindow.on('unmaximize', () => this.resize())
  }

  get activeTab() {
    return this.tabs.get(this.activeTabId || '')
  }

  createTab(url: string): string {
    const id = `tab-${Date.now().toString(32)}`

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // sandbox: true,
        session: this.session,
        preload: PRELOAD_PATH
      }
    })

    const tab: TabInfo = {
      id,
      view,
      url,
      title: 'Loading',
      canGoBack: false,
      canGoForward: false,
      isLoading: true
    }

    this.tabs.set(id, tab)
    this.setupEvents(id, view)

    view.webContents.loadURL(url)

    // 如果是第一个标签页，立即显示
    if (this.tabs.size === 1) {
      this.switchTab(id)
    }

    this.notify('tab:created', this.serializeTab(tab))
    return id
  }

  private setupEvents(id: string, view: BrowserView): void {
    const web = view.webContents

    web.on('page-title-updated', (_, title) => {
      this.updateTab(id, { title })
    })

    web.on('did-navigate', (_, url) => {
      this.updateTab(id, {
        url,
        canGoBack: web.canGoBack(),
        canGoForward: web.canGoForward()
      })
    })

    web.on('did-start-loading', () => this.updateTab(id, { isLoading: true }))
    web.on('did-stop-loading', () =>
      this.updateTab(id, {
        isLoading: false,
        canGoBack: web.canGoBack(),
        canGoForward: web.canGoForward()
      })
    )

    // 页面加载完成后再调整大小（确保内容正确渲染）
    web.on('dom-ready', () => {
      if (this.activeTabId === id) {
        this.resize()
      }
    })

    web.setWindowOpenHandler(({ url }) => {
      this.createTab(url)
      return { action: 'deny' }
    })
  }

  private setupDownloadHandler(): void {
    this.session.on('will-download', (e, item) => {
      e.preventDefault()

      const id = `dl-${Date.now().toString(32)}`

      dialog
        .showSaveDialog(this.mainWindow, {
          defaultPath: item.getFilename()
        })
        .then(({ filePath }) => {
          if (!filePath) {
            this.notify('download:cancelled', { id })
            return
          }

          const download: DownloadItem = {
            id,
            filename: item.getFilename(),
            path: filePath,
            totalBytes: item.getTotalBytes(),
            receivedBytes: 0,
            state: 'progressing',
            startTime: Date.now()
          }

          this.downloads.set(id, download)
          item.setSavePath(filePath)

          this.notify('download:added', {
            ...download,
            progress: 0,
            percent: 0
          })

          let lastReceived = 0
          let lastTime = Date.now()

          item.on('updated', (_, state) => {
            const dl = this.downloads.get(id)!
            dl.receivedBytes = item.getReceivedBytes()

            if (state === 'interrupted') {
              dl.state = 'failed'
            }

            // 手动计算速度
            const now = Date.now()
            const timeDiff = (now - lastTime) / 1000
            const bytesDiff = dl.receivedBytes - lastReceived
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0

            lastReceived = dl.receivedBytes
            lastTime = now

            const progress =
              dl.totalBytes > 0 ? dl.receivedBytes / dl.totalBytes : 0

            this.notify('download:updated', {
              id: dl.id,
              receivedBytes: dl.receivedBytes,
              totalBytes: dl.totalBytes,
              speed,
              state: dl.state,
              progress,
              percent: Math.round(progress * 100)
            })
          })

          item.once('done', (_, state) => {
            const dl = this.downloads.get(id)!
            dl.state = state === 'completed' ? 'completed' : 'failed'
            dl.endTime = Date.now()

            this.notify('download:completed', {
              id: dl.id,
              state: dl.state,
              path: dl.path
            })
          })
        })
    })
  }

  getDownloads(): (DownloadItem & { progress: number; percent: number })[] {
    return Array.from(this.downloads.values()).map((d) => ({
      ...d,
      progress: d.totalBytes > 0 ? d.receivedBytes / d.totalBytes : 0,
      percent:
        d.totalBytes > 0
          ? Math.round((d.receivedBytes / d.totalBytes) * 100)
          : 0
    }))
  }

  openDownload(id: string): void {
    const dl = this.downloads.get(id)
    if (dl && dl.state === 'completed') {
      shell.openPath(dl.path)
    }
  }

  showInFolder(id: string): void {
    const dl = this.downloads.get(id)
    if (dl) {
      shell.showItemInFolder(dl.path)
    }
  }

  removeDownload(id: string): void {
    this.downloads.delete(id)
    this.notify('download:removed', id)
  }

  clearCompleted(): void {
    const completed = Array.from(this.downloads.entries())
      .filter(([, d]) => d.state !== 'progressing')
      .map(([id]) => id)

    completed.forEach((id) => this.downloads.delete(id))
    this.notify('download:cleared', completed)
  }

  switchTab(id: string): void {
    if (this.activeTabId === id) return

    const tab = this.tabs.get(id)
    if (!tab) return

    if (this.activeTab) {
      this.mainWindow.removeBrowserView(this.activeTab.view)
    }

    this.mainWindow.setBrowserView(tab.view)
    this.activeTabId = id

    // tab.view.setAutoResize({ width: true, height: true })
    this.resize()

    // 确保 webContents 聚焦
    tab.view.webContents.focus()

    this.notify('tab:switched', this.serializeTab(tab))
  }

  cancelDownload(id: string): void {
    // 注意：electron 的 DownloadItem 没有直接取消方法，可以通过销毁 webContents 实现
    // 这里仅标记状态
    const dl = this.downloads.get(id)
    if (dl && dl.state === 'progressing') {
      dl.state = 'cancelled'
      dl.endTime = Date.now()
      this.notify('download:updated', { id, state: 'cancelled' })
    }
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    tab.view.webContents.close()
    this.tabs.delete(id)

    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys())
      if (remaining.length) {
        this.switchTab(remaining[0])
      } else {
        this.activeTabId = null
        this.mainWindow.setBrowserView(null)
      }
    }

    this.notify('tab:closed', id)
  }

  navigate(id: string, url: string): void {
    this.tabs.get(id)?.view.webContents.loadURL(url)
  }

  goBack(id: string): void {
    this.tabs.get(id)?.view.webContents.goBack()
  }

  goForward(id: string): void {
    this.tabs.get(id)?.view.webContents.goForward()
  }

  reload(id: string): void {
    this.tabs.get(id)?.view.webContents.reload()
  }

  resize(): void {
    const tab = this.activeTab
    if (!tab) return

    const contentBounds = this.mainWindow.getContentBounds()

    const viewBounds = {
      x: 0,
      y: this.tabBarHeight,
      width: contentBounds.width,
      height: contentBounds.height - this.tabBarHeight
    }

    tab.view.setBounds(viewBounds)

    // 强制重绘
    tab.view.webContents.invalidate()
  }

  getAllTabs() {
    return Array.from(this.tabs.values()).map((t) => this.serializeTab(t))
  }

  private updateTab(id: string, data: Partial<TabInfo>): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    Object.assign(tab, data)
    this.notify('tab:updated', { id, ...data })
  }

  private serializeTab(tab: TabInfo) {
    return {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      isLoading: tab.isLoading
    }
  }

  private notify(channel: string, data: unknown): void {
    this.mainWindow.webContents.send(channel, data)
  }
}
