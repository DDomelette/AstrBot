import { useModuleI18n } from '@/i18n/composables'
import { usePluginI18n } from '@/utils/pluginI18n'

export function useConfigTextResolver(props = {}) {
  const { tm, getRaw } = useModuleI18n('features/config-metadata')
  const { configText } = usePluginI18n()

  const translateIfKey = (value) => {
    if (!value || typeof value !== 'string') return value
    // PATCH: 2026-06-03 - only treat dot-separated paths as i18n keys; plain text is returned as-is
    if (!value.includes('.')) return value
    return getRaw(value) ? tm(value) : null
  }

  const hasPluginI18n = () => {
    return Boolean(
      props.pluginName
      && props.pluginI18n
      && Object.keys(props.pluginI18n).length > 0,
    )
  }

  const resolveConfigText = (path, attr, fallback) => {
    const fallbackText = translateIfKey(fallback) || ''
    if (!hasPluginI18n()) {
      return fallbackText
    }
    return configText(props.pluginI18n, path, attr, fallbackText)
  }

  return {
    translateIfKey,
    resolveConfigText,
  }
}
