import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {} as const

export type GlobalApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronApi', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
