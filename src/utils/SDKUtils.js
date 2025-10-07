export class SDKUtils {
  // Position and vector utilities
  static distance(pos1, pos2) {
    const [x1, y1, z1] = pos1
    const [x2, y2, z2] = pos2
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2)
  }

  static lerp(start, end, t) {
    return start + (end - start) * t
  }

  static lerpVector3(start, end, t) {
    return [
      this.lerp(start[0], end[0], t),
      this.lerp(start[1], end[1], t),
      this.lerp(start[2], end[2], t)
    ]
  }

  static lerpQuaternion(start, end, t) {
    // Simplified quaternion interpolation
    const result = start.map((s, i) => this.lerp(s, end[i], t))
    const magnitude = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0))
    return magnitude > 0 ? result.map(val => val / magnitude) : [0, 0, 0, 1]
  }

  static normalizeVector3(vector) {
    const [x, y, z] = vector
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    if (magnitude === 0) return [0, 0, 0]
    return [x / magnitude, y / magnitude, z / magnitude]
  }

  static addVector3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  }

  static subtractVector3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  }

  static multiplyVector3(vector, scalar) {
    return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]
  }

  static crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]
  }

  static dotProduct(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  }

  // Euler to quaternion conversion
  static eulerToQuaternion(x, y, z) {
    const cx = Math.cos(x / 2)
    const sx = Math.sin(x / 2)
    const cy = Math.cos(y / 2)
    const sy = Math.sin(y / 2)
    const cz = Math.cos(z / 2)
    const sz = Math.sin(z / 2)

    return [
      sx * cy * cz - cx * sy * sz,
      cx * sy * cz + sx * cy * sz,
      cx * cy * sz - sx * sy * cz,
      cx * cy * cz + sx * sy * sz
    ]
  }

  // Quaternion utilities
  static quaternionToEuler(x, y, z, w) {
    const test = x * y + z * w
    if (test > 0.499) {
      return [Math.PI / 2, 2 * Math.atan2(x, w), 0]
    }
    if (test < -0.499) {
      return [-Math.PI / 2, -2 * Math.atan2(x, w), 0]
    }
    const sqx = x * x
    const sqy = y * y
    const sqz = z * z
    return [
      Math.asin(2 * test),
      Math.atan2(2 * y * w - 2 * x * z, 1 - 2 * sqy - 2 * sqz),
      Math.atan2(2 * x * w - 2 * y * z, 1 - 2 * sqx - 2 * sqz)
    ]
  }

  static quaternionMultiply(q1, q2) {
    const [x1, y1, z1, w1] = q1
    const [x2, y2, z2, w2] = q2

    return [
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
      w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
      w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2
    ]
  }

  // String utilities
  static generateId(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  static generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  static slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }

  static capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  static truncate(str, length, suffix = '...') {
    if (str.length <= length) return str
    return str.substring(0, length - suffix.length) + suffix
  }

  // Time utilities
  static formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  static formatTime(timestamp, format = 'relative') {
    const now = Date.now()
    const diff = now - timestamp

    if (format === 'relative') {
      if (diff < 60000) return 'just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      return new Date(timestamp).toLocaleDateString()
    } else {
      return new Date(timestamp).toISOString()
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Array utilities
  static chunk(array, size) {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  static shuffle(array) {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  static unique(array) {
    return [...new Set(array)]
  }

  static groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = typeof key === 'function' ? key(item) : item[key]
      groups[group] = groups[group] || []
      groups[group].push(item)
      return groups
    }, {})
  }

  // Object utilities
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  static deepMerge(target, ...sources) {
    if (!sources.length) return target
    const source = sources.shift()

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} })
          this.deepMerge(target[key], source[key])
        } else {
          Object.assign(target, { [key]: source[key] })
        }
      }
    }

    return this.deepMerge(target, ...sources)
  }

  static isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item)
  }

  static pick(obj, keys) {
    return keys.reduce((result, key) => {
      if (key in obj) {
        result[key] = obj[key]
      }
      return result
    }, {})
  }

  static omit(obj, keys) {
    const result = { ...obj }
    keys.forEach(key => delete result[key])
    return result
  }

  // Validation utilities
  static isValidPosition(position) {
    return Array.isArray(position) &&
           position.length === 3 &&
           position.every(coord => typeof coord === 'number' && isFinite(coord))
  }

  static isValidQuaternion(quaternion) {
    return Array.isArray(quaternion) &&
           quaternion.length === 4 &&
           quaternion.every(q => typeof q === 'number' && isFinite(q))
  }

  static isValidScale(scale) {
    return this.isValidPosition(scale) &&
           scale.every(s => s > 0)
  }

  static isValidColor(color) {
    return typeof color === 'string' &&
           (/^#[0-9A-F]{6}$/i.test(color) || /^rgb\(\d+,\s*\d+,\s*\d+\)$/i.test(color))
  }

  static isValidUrl(url) {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Color utilities
  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  static rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }

  static rgbToHsl(r, g, b) {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
  }

  // Performance utilities
  static debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  static throttle(func, limit) {
    let inThrottle
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }

  static async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (attempt < maxAttempts) {
          await this.sleep(delay * attempt)
        }
      }
    }
    throw lastError
  }

  // Geometry utilities
  static getBoundingSphere(center, radius) {
    return { center, radius }
  }

  static pointInSphere(point, sphere) {
    const distance = this.distance(point, sphere.center)
    return distance <= sphere.radius
  }

  static getRandomPointInSphere(center, radius) {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const r = radius * Math.cbrt(Math.random())

    const x = center[0] + r * Math.sin(phi) * Math.cos(theta)
    const y = center[1] + r * Math.sin(phi) * Math.sin(theta)
    const z = center[2] + r * Math.cos(phi)

    return [x, y, z]
  }

  static getCirclePoints(center, radius, count, startAngle = 0) {
    const points = []
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i / count) * Math.PI * 2
      points.push([
        center[0] + Math.cos(angle) * radius,
        center[1],
        center[2] + Math.sin(angle) * radius
      ])
    }
    return points
  }

  // Debug utilities
  static createDebugLogger(enabled = false) {
    return {
      log: (...args) => {
        if (enabled) console.log('[DEBUG]', ...args)
      },
      error: (...args) => {
        if (enabled) console.error('[ERROR]', ...args)
      },
      warn: (...args) => {
        if (enabled) console.warn('[WARN]', ...args)
      },
      group: (label) => {
        if (enabled) console.group(label)
      },
      groupEnd: () => {
        if (enabled) console.groupEnd()
      }
    }
  }

  static measureTime(fn) {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    return { result, duration: end - start }
  }

  static async measureTimeAsync(fn) {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    return { result, duration: end - start }
  }
}