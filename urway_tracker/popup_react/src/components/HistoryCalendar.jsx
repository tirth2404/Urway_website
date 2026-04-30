import React, { useState, useMemo } from 'react'

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return '0s'
  seconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function HistoryCalendar({ days = [], onDateClick, onBack }) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [hoveredDate, setHoveredDate] = useState(null)

  // Build lookup: "M/D/YYYY" -> { totalDuration, siteCount }
  const dayMap = useMemo(() => {
    const m = {}
    days.forEach(d => {
      if (d.date) m[d.date] = d
    })
    return m
  }, [days])

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null)
    } else {
      cells.push(dayNum)
    }
  }

  // Navigation
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }

  // Format date key for lookup (matches backend "M/D/YYYY" format)
  function dateKey(day) {
    return `${viewMonth + 1}/${day}/${viewYear}`
  }

  // Color intensity based on duration
  function getCellClass(day) {
    if (!day) return 'cal-cell cal-empty'
    const entry = dayMap[dateKey(day)]
    const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear()
    let cls = 'cal-cell cal-day'
    if (isToday) cls += ' cal-today'
    if (entry) {
      const dur = entry.totalDuration || 0
      if (dur > 7200) cls += ' cal-heat-4'
      else if (dur > 3600) cls += ' cal-heat-3'
      else if (dur > 1800) cls += ' cal-heat-2'
      else if (dur > 0) cls += ' cal-heat-1'
    }
    return cls
  }

  // Summary stats
  const totalDays = days.length
  const totalTime = days.reduce((s, d) => s + (d.totalDuration || 0), 0)

  return (
    <div className="history-view">
      <div className="history-header">
        <button className="back-button" onClick={onBack}>
          <span className="back-icon">←</span> Back
        </button>
        <div className="history-title">
          <div className="history-heading">Activity History</div>
          <div className="history-stats">{totalDays} active day{totalDays !== 1 ? 's' : ''} · {formatDuration(totalTime)} total</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="cal-container">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <div className="cal-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</div>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>

        <div className="cal-grid">
          {DAY_LABELS.map(d => <div key={d} className="cal-cell cal-header">{d}</div>)}
          {cells.map((day, i) => {
            const entry = day ? dayMap[dateKey(day)] : null
            return (
              <div
                key={i}
                className={getCellClass(day)}
                onClick={() => { if (day && entry) onDateClick(dateKey(day)) }}
                onMouseEnter={() => day && setHoveredDate(day)}
                onMouseLeave={() => setHoveredDate(null)}
                style={{ cursor: day && entry ? 'pointer' : 'default' }}
              >
                {day || ''}
                {hoveredDate === day && day && entry && (
                  <div className="cal-tooltip">
                    <div className="cal-tooltip-date">{dateKey(day)}</div>
                    <div className="cal-tooltip-duration">{formatDuration(entry.totalDuration)}</div>
                    <div className="cal-tooltip-sites">{entry.siteCount} site{entry.siteCount !== 1 ? 's' : ''}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="cal-legend">
          <span className="cal-legend-label">Less</span>
          <span className="cal-legend-box cal-legend-0"></span>
          <span className="cal-legend-box cal-legend-1"></span>
          <span className="cal-legend-box cal-legend-2"></span>
          <span className="cal-legend-box cal-legend-3"></span>
          <span className="cal-legend-box cal-legend-4"></span>
          <span className="cal-legend-label">More</span>
        </div>
      </div>

      {/* Recent days list below calendar */}
      <div className="history-list">
        <div className="history-list-header">Recent Activity</div>
        {days.slice(0, 10).map(d => (
          <div key={d.date} className="history-day-row" onClick={() => onDateClick(d.date)}>
            <div className="history-day-date">{d.date}</div>
            <div className="history-day-info">
              <span className="history-day-sites">{d.siteCount} site{d.siteCount !== 1 ? 's' : ''}</span>
              <span className="history-day-duration">{formatDuration(d.totalDuration)}</span>
            </div>
            <div className="history-day-arrow">▶</div>
          </div>
        ))}
      </div>
    </div>
  )
}
