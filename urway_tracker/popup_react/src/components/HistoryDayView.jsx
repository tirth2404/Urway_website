import React, { useState, useEffect } from 'react'
import CryptoUtils from '../utils/crypto-utils'

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return ''
  seconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function formatTimeFromSegment(seg) {
  if (!seg) return { start: null, end: null }
  let start = seg.startTimestamp || seg.timestamps?.startTimestamp
  let end = seg.endTimestamp || seg.timestamps?.endTimestamp
  if (start && end && start === end && seg.duration && seg.duration > 0) {
    end = new Date(new Date(start).getTime() + seg.duration * 1000).toISOString()
  }
  try {
    const s = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null
    const e = end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null
    return { start: s, end: e }
  } catch (e) { return { start: null, end: null } }
}

export default function HistoryDayView({ date, userEmail, registrationTimestamp, onBack }) {
  const [sites, setSites] = useState([])
  const [totalDuration, setTotalDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedDomain, setExpandedDomain] = useState(null)
  const [expandedTitle, setExpandedTitle] = useState(null)

  useEffect(() => {
    fetchDayData()
  }, [date])

  async function fetchDayData() {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:5000/activities?userEmail=${encodeURIComponent(userEmail)}&date=${encodeURIComponent(date)}`)
      const result = await res.json()
      const rawSites = result.sites || []

      const nd = (d) => { let x = String(d || '').toLowerCase().trim(); if (x.startsWith('www.')) x = x.slice(4); return x || 'unknown' }

      // Process each site: decrypt segments, use server duration
      const domainMap = new Map()
      for (const site of rawSites) {
        const domain = nd(site.domain)
        const siteTitle = site.title
        const siteUrl = site.url

        const segments = []
        for (const seg of site.segments || []) {
          const serverDuration = seg.duration
          const serverStart = seg.startTimestamp
          const serverEnd = seg.endTimestamp
          let title = siteTitle
          let url = siteUrl

          if (seg.encryptedData && registrationTimestamp) {
            try {
              const key = await CryptoUtils.deriveKeyFromTimestamp(userEmail, registrationTimestamp)
              const obj = await CryptoUtils.decryptActivity(seg.encryptedData, key)
              title = obj.title || siteTitle
              url = obj.url || siteUrl
            } catch (e) { /* use site-level */ }
          } else if (seg.unencryptedData) {
            title = seg.unencryptedData.title || siteTitle
            url = seg.unencryptedData.url || siteUrl
          }

          segments.push({
            title, url, domain,
            duration: serverDuration || 0,
            startTimestamp: serverStart,
            endTimestamp: serverEnd,
            timestamps: { startTimestamp: serverStart, endTimestamp: serverEnd }
          })
        }

        const siteTotal = Number(site.totalDuration || 0)

        if (domainMap.has(domain)) {
          const existing = domainMap.get(domain)
          existing.segments.push(...segments)
          existing.total += siteTotal
        } else {
          domainMap.set(domain, { domain, segments: [...segments], total: siteTotal })
        }
      }

      const sorted = Array.from(domainMap.values()).sort((a, b) => b.total - a.total)
      const total = sorted.reduce((s, d) => s + d.total, 0)
      setSites(sorted)
      setTotalDuration(total)
    } catch (e) {
      console.error('Failed to fetch day data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Group segments by title within a domain
  function groupByTitle(segments) {
    const map = {}
    segments.forEach(seg => {
      const title = seg.title || '(no title)'
      if (!map[title]) map[title] = { title, url: seg.url, segments: [], total: 0 }
      if (seg.url) map[title].url = map[title].url || seg.url
      map[title].segments.push(seg)
      map[title].total += Number(seg.duration || 0)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          <span className="back-icon">←</span> Back
        </button>
        <div className="detail-title">
          <div className="detail-domain">{date}</div>
          <div className="detail-total">Total: {formatDuration(totalDuration)}</div>
        </div>
      </div>

      <div className="detail-content">
        {loading ? (
          <div className="loading">Loading history...</div>
        ) : sites.length === 0 ? (
          <div className="empty-state">No activity recorded on this date</div>
        ) : (
          sites.map((site, idx) => {
            const isDomainExpanded = expandedDomain === idx
            const titleGroups = groupByTitle(site.segments)

            return (
              <div key={idx} className="detail-card">
                <div className="detail-card-header" onClick={() => setExpandedDomain(isDomainExpanded ? null : idx)}>
                  <div className="detail-card-left">
                    <div className="detail-card-title" style={{ fontSize: '15px' }}>{site.domain}</div>
                    <div className="detail-card-meta">{titleGroups.length} page{titleGroups.length !== 1 ? 's' : ''} · {site.segments.length} session{site.segments.length !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="detail-card-right">
                    <div className="detail-card-duration">{formatDuration(site.total)}</div>
                    <div className="detail-card-toggle">{isDomainExpanded ? '▼' : '▶'}</div>
                  </div>
                </div>

                {isDomainExpanded && (
                  <div className="detail-card-body">
                    {titleGroups.map((tg, ti) => {
                      const isTitleExpanded = expandedTitle === `${idx}-${ti}`
                      return (
                        <div key={ti} className="history-title-group">
                          <div className="history-title-header" onClick={() => setExpandedTitle(isTitleExpanded ? null : `${idx}-${ti}`)}>
                            <div className="history-title-left">
                              <div className="history-title-text">{tg.title}</div>
                              {tg.url && (
                                <a href="#" className="history-title-url" onClick={(e) => { e.stopPropagation(); window.open(tg.url, '_blank') }}>
                                  {tg.url}
                                </a>
                              )}
                            </div>
                            <div className="history-title-right">
                              <span className="history-title-dur">{formatDuration(tg.total)}</span>
                              <span className="history-title-toggle">{isTitleExpanded ? '▼' : '▶'}</span>
                            </div>
                          </div>

                          {isTitleExpanded && (
                            <div className="history-sessions">
                              {tg.segments.map((seg, si) => {
                                const { start, end } = formatTimeFromSegment(seg)
                                return (
                                  <div key={si} className="session-item">
                                    <div className="session-time">
                                      {start && end ? (
                                        <>
                                          <span className="time-label">Watched:</span>
                                          <span className="time-value">{start} - {end}</span>
                                        </>
                                      ) : <span className="time-value">Time not available</span>}
                                    </div>
                                    <div className="session-duration">
                                      <span className="duration-label">Duration:</span>
                                      <span className="duration-value">{formatDuration(seg.duration)}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
