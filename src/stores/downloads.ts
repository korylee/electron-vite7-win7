import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Download {
  id: string
  filename: string
  path: string
  totalBytes: number
  receivedBytes: number
  state: 'progressing' | 'completed' | 'failed' | 'cancelled'
  startTime: number
  endTime?: number
  speed: number
  progress: number
  percent: number
}

export const useDownloadsStore = defineStore('downloads', () => {
  const items = ref<Download[]>([])
  const visible = ref(false)

  const activeCount = computed(
    () => items.value.filter((d) => d.state === 'progressing').length
  )
  const completedCount = computed(
    () => items.value.filter((d) => d.state === 'completed').length
  )

  const add = (dl: Download) => {
    items.value.unshift({
      ...dl,
      speed: dl.speed || 0
    })
  }

  const update = (id: string, data: Partial<Download>) => {
    const item = items.value.find((d) => d.id === id)
    if (!item) return
    Object.assign(item, data)
    if (data.receivedBytes && data.totalBytes) {
      item.progress = data.receivedBytes / data.totalBytes
      item.percent = Math.round(item.progress * 100)
    }
  }
  const remove = (id: string) => {
    items.value = items.value.filter((d) => d.id !== id)
  }

  const clearCompleted = () => {
    items.value = items.value.filter((d) => d.state === 'progressing')
  }

  const setVisible = (v: boolean) => {
    visible.value = v
  }
  const toggle = () => {
    visible.value = !visible.value
    console.log(visible.value, 'visible.value')
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  const formatSpeed = (bytes: number) => {
    return formatSize(bytes) + '/s'
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return '未知'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  return {
    items,
    visible,
    activeCount,
    completedCount,
    add,
    update,
    remove,
    clearCompleted,
    setVisible,
    toggle,
    formatSize,
    formatSpeed,
    formatTime,
  }
})
