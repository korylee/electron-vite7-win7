<template>
  <div class="browser-container">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <!-- 标签页区域 -->
      <div class="tabs-wrapper">
        <div
          v-for="tab in tabStore.tabs"
          :key="tab.id"
          :class="['tab', { active: tab.id === tabStore.activeId }]"
          @click="switchTab(tab.id)"
        >
          <span v-if="tab.isLoading" class="loading-dot"></span>
          <span v-else class="site-dot"></span>
          <span class="tab-title">{{ tab.title }}</span>
          <button class="close-btn" @click.stop="closeTab(tab.id)">×</button>
        </div>
      </div>

      <!-- 下载按钮 -->
      <button
        class="download-btn"
        :class="{ 'has-active': downloadStore.activeCount > 0 }"
        @click="downloadStore.toggle()"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span v-if="downloadStore.activeCount > 0" class="badge">{{
          downloadStore.activeCount
        }}</span>
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="content-area">
      <div v-if="tabStore.tabs.length === 0" class="empty-state">
        <p>没有打开的标签页</p>
      </div>
    </div>

    <!-- 下载面板 -->
    <Teleport to="body">
      <Transition name="panel">
        <div v-if="downloadStore.visible" class="download-panel">
          <div class="panel-header">
            <span>下载</span>
            <button
              v-if="downloadStore.completedCount > 0"
              class="clear-btn"
              @click="clearCompleted"
            >
              清除
            </button>
            <button class="close-btn" @click="downloadStore.setVisible(false)">
              ×
            </button>
          </div>

          <div v-if="downloadStore.items.length > 0" class="download-list">
            <div
              v-for="item in downloadStore.items"
              :key="item.id"
              :class="['download-item', item.state]"
            >
              <div class="file-icon" :class="item.state">
                <svg
                  v-if="item.state === 'progressing'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                </svg>
                <svg
                  v-else-if="item.state === 'completed'"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <svg
                  v-else
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  />
                </svg>
              </div>

              <div class="file-info">
                <div class="filename">{{ item.filename }}</div>
                <div class="file-meta">
                  <template v-if="item.state === 'progressing'">
                    {{ downloadStore.formatSize(item.receivedBytes) }} /
                    {{ downloadStore.formatSize(item.totalBytes) }}
                    <span class="speed">{{
                      downloadStore.formatSpeed(item.speed)
                    }}</span>
                  </template>
                  <template v-else-if="item.state === 'completed'"
                    >完成</template
                  >
                  <template v-else-if="item.state === 'failed'">失败</template>
                  <template v-else>已取消</template>
                </div>

                <div v-if="item.state === 'progressing'" class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{ width: item.percent + '%' }"
                  ></div>
                </div>
              </div>

              <div class="actions">
                <template v-if="item.state === 'completed'">
                  <button
                    class="action-btn"
                    @click="openFile(item.id)"
                    title="打开"
                  >
                    ↗
                  </button>
                  <button
                    class="action-btn"
                    @click="showInFolder(item.id)"
                    title="文件夹"
                  >
                    📁
                  </button>
                </template>
                <button
                  v-if="item.state !== 'progressing'"
                  class="action-btn delete"
                  @click="removeDownload(item.id)"
                  title="删除"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div v-else class="empty-downloads">暂无下载</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useDownloadsStore } from '@/stores/downloads'

const tabStore = useTabsStore()
const downloadStore = useDownloadsStore()

const switchTab = (id: string) => {
  window.api.tab.switch(id)
  tabStore.setActive(id)
}

const closeTab = (id: string) => {
  window.api.tab.close(id)
  tabStore.removeTab(id)
}

const openFile = (id: string) => window.api.download.open(id)
const showInFolder = (id: string) => window.api.download.show(id)
const removeDownload = (id: string) => {
  window.api.download.remove(id)
  downloadStore.remove(id)
}
const clearCompleted = () => {
  window.api.download.clear()
  downloadStore.clearCompleted()
}

const cleanups: (() => void)[] = []

onMounted(async () => {
  const tabs = await window.api.tab.getAll()
  tabs.forEach((tab) => tabStore.addTab(tab))
  if (tabs.length > 0) tabStore.setActive(tabs[0].id)

  const downloads = await window.api.download.getAll()
  downloads.forEach((d) => downloadStore.add(d))

  const on = (channel: string, handler: (...args: any[]) => void) => {
    const cleanup = window.api.on(channel, handler)
    cleanups.push(cleanup)
  }

  on('tab:created', (tab) => tabStore.addTab(tab))
  on('tab:switched', ({ id }) => tabStore.setActive(id))
  on('tab:closed', (id) => tabStore.removeTab(id))
  on('tab:updated', ({ id, ...data }) => tabStore.updateTab(id, data))

  on('download:added', (data) => {
    downloadStore.add({ ...data, speed: 0 })
    downloadStore.setVisible(true)
  })
  on('download:updated', (data) => downloadStore.update(data.id, data))
  on('download:completed', (data) =>
    downloadStore.update(data.id, { state: data.state, endTime: Date.now() })
  )
  on('download:removed', (id) => downloadStore.remove(id))
  on('download:cleared', (ids: string[]) =>
    ids.forEach((id) => downloadStore.remove(id))
  )
})

onUnmounted(() => {
  cleanups.forEach((fn) => fn())
})
</script>

<style scoped>
.browser-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.top-bar {
  height: 40px;
  display: flex;
  align-items: center;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 8px;
}

.tabs-wrapper {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 4px;
  overflow-x: auto;
  height: 100%;
  padding-top: 4px;
}

.tab {
  height: 36px;
  min-width: 140px;
  max-width: 200px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: #e8e8e8;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  position: relative;
  font-size: 13px;
  color: #666;
  user-select: none;
  transition: all 0.2s;
}

.tab:hover {
  background: #e0e0e0;
}

.tab.active {
  background: #fff;
  color: #333;
  border-bottom: 2px solid #3b82f6;
}

.loading-dot {
  width: 12px;
  height: 12px;
  border: 2px solid #e0e0e0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.site-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #999;
  opacity: 0;
  transition: all 0.2s;
}

.tab:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  background: #ddd;
  color: #333;
}

.download-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  margin-left: 8px;
  position: relative;
  transition: all 0.2s;
}

.download-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.download-btn.has-active {
  background: #3b82f6;
  color: #fff;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.content-area {
  flex: 1;
  background: #fff;
  position: relative;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

.download-panel {
  position: fixed;
  top: 48px;
  right: 12px;
  width: 320px;
  max-height: 400px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f8f8;
  border-bottom: 1px solid #e0e0e0;
  font-size: 14px;
  font-weight: 500;
}

.clear-btn {
  font-size: 12px;
  color: #666;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.clear-btn:hover {
  background: #e0e0e0;
}

.panel-header .close-btn {
  width: 24px;
  height: 24px;
  opacity: 1;
}

.download-list {
  overflow-y: auto;
  padding: 8px;
  max-height: 320px;
}

.download-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.download-item:hover {
  background: #f5f5f5;
}

.download-item.completed {
  border-left: 3px solid #22c55e;
}

.download-item.failed,
.download-item.cancelled {
  border-left: 3px solid #ef4444;
  opacity: 0.7;
}

.file-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #e8e8e8;
  color: #666;
}

.file-icon.progressing {
  background: #dbeafe;
  color: #3b82f6;
}

.file-icon.completed {
  background: #dcfce7;
  color: #22c55e;
}

.file-icon.failed,
.file-icon.cancelled {
  background: #fee2e2;
  color: #ef4444;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.filename {
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.file-meta {
  font-size: 11px;
  color: #666;
}

.speed {
  margin-left: 8px;
  color: #3b82f6;
}

.progress-bar {
  height: 3px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.3s;
}

.actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.download-item:hover .actions {
  opacity: 1;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  background: #f0f0f0;
}

.action-btn.delete:hover {
  background: #fee2e2;
  color: #ef4444;
}

.empty-downloads {
  padding: 32px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

/* 动画 */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.2s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
