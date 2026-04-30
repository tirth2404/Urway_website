import React, { useState } from 'react'

function formatDuration(seconds){
  if (!seconds && seconds !== 0) return ''
  seconds = Math.max(0, Math.round(seconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function formatTimeFromSegment(seg){
  if (!seg) return {start: null, end: null}
  let start = null, end = null
  
  // Try multiple ways to extract timestamps
  if (seg.timestamps) {
    if (Array.isArray(seg.timestamps) && seg.timestamps.length){
      start = seg.timestamps[0]
      end = seg.timestamps[seg.timestamps.length-1]
    } else if (seg.timestamps.startTimestamp || seg.timestamps.endTimestamp){
      start = seg.timestamps.startTimestamp
      end = seg.timestamps.endTimestamp
    }
  }
  
  // Fallback to direct properties
  if (!start) start = seg.startTimestamp || seg.raw?.startTimestamp || seg.raw?.timestamps?.startTimestamp
  if (!end) end = seg.endTimestamp || seg.raw?.endTimestamp || seg.raw?.timestamps?.endTimestamp
  
  // If start and end are the same but we have duration, calculate end from duration
  if (start && end && start === end && seg.duration && seg.duration > 0) {
    end = new Date(new Date(start).getTime() + seg.duration * 1000).toISOString()
  }
  
  try{
    const s = start ? new Date(start).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}) : null
    const e = end ? new Date(end).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}) : null
    return {start: s, end: e}
  }catch(e){ 
    console.error('Error formatting timestamp:', e, {start, end, seg})
    return {start: null, end: null} 
  }
}

export default function DomainDetailView({ domain, items, totalDuration, onBack }){
  const [expandedIndex, setExpandedIndex] = useState(null)

  console.log('DomainDetailView - domain:', domain)
  console.log('DomainDetailView - items count:', items.length)
  console.log('DomainDetailView - first 3 items:', items.slice(0, 3))

  // Group items by title
  const titleGroups = {}
  items.forEach((it, idx) => {
    // Try multiple ways to extract title
    let title = it.title || 
                it.unencryptedData?.title || 
                it.raw?.title ||
                it.raw?.unencryptedData?.title ||
                ''
    
    // Try multiple ways to extract URL
    let url = it.url || 
              it.unencryptedData?.url || 
              it.raw?.url ||
              it.raw?.unencryptedData?.url ||
              ''
    
    // If still no title but have URL, extract from URL path
    if (!title && url) {
      try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split('/').filter(Boolean)
        if (pathParts.length > 0) {
          title = decodeURIComponent(pathParts[pathParts.length - 1])
        }
      } catch (e) {
        // URL parsing failed
      }
    }
    
    // Final fallback
    if (!title) title = '(no title)'
    
    if (!titleGroups[title]) {
      titleGroups[title] = {
        title,
        segments: [],
        total: 0,
        urls: new Set()
      }
    }
    
    if (url) titleGroups[title].urls.add(url)
    titleGroups[title].segments.push({...it, extractedTitle: title, extractedUrl: url})
    titleGroups[title].total += Number(it.duration) || 0
  })

  const groups = Object.values(titleGroups).sort((a, b) => b.total - a.total)
  
  console.log('DomainDetailView - grouped titles:', groups.map(g => ({ title: g.title, count: g.segments.length, total: g.total })))

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          <span className="back-icon">←</span> Back
        </button>
        <div className="detail-title">
          <div className="detail-domain">{domain}</div>
          <div className="detail-total">Total: {formatDuration(totalDuration)}</div>
        </div>
      </div>

      <div className="detail-content">
        {groups.map((group, idx) => {
          const firstUrl = Array.from(group.urls)[0]
          const isExpanded = expandedIndex === idx

          return (
            <div key={idx} className="detail-card">
              <div className="detail-card-header" onClick={() => setExpandedIndex(isExpanded ? null : idx)}>
                <div className="detail-card-left">
                  <div className="detail-card-title">{group.title}</div>
                  {firstUrl && (
                    <div className="detail-card-url">
                      <span className="url-icon">🔗</span>
                      <a href="#" onClick={(e) => {e.stopPropagation(); window.open(firstUrl, '_blank')}} className="url-link">
                        {(() => {try{return new URL(firstUrl).hostname}catch(e){return firstUrl}})()}
                      </a>
                    </div>
                  )}
                  <div className="detail-card-meta">{group.segments.length} viewing session{group.segments.length > 1 ? 's' : ''}</div>
                </div>
                <div className="detail-card-right">
                  <div className="detail-card-duration">{formatDuration(group.total)}</div>
                  <div className="detail-card-toggle">{isExpanded ? '▼' : '▶'}</div>
                </div>
              </div>

              {isExpanded && (
                <div className="detail-card-body">
                  <div className="sessions-header">Viewing Sessions:</div>
                  {group.segments.map((seg, si) => {
                    const {start, end} = formatTimeFromSegment(seg)
                    const url = seg.extractedUrl || seg.url || seg.unencryptedData?.url || seg.raw?.url || ''
                    const duration = formatDuration(seg.duration)
                    
                    return (
                      <div key={si} className="session-item">
                        <div className="session-title-box">
                          <span className="session-title-label">Video:</span>
                          <span className="session-title-text">{group.title}</span>
                        </div>
                        <div className="session-time">
                          {start && end ? (
                            <>
                              <span className="time-label">Watched:</span>
                              <span className="time-value">{start} - {end}</span>
                            </>
                          ) : (
                            <span className="time-value">Time not available</span>
                          )}
                        </div>
                        <div className="session-duration">
                          <span className="duration-label">Duration:</span>
                          <span className="duration-value">{duration}</span>
                        </div>
                        {url && (
                          <div className="session-url">
                            <span className="url-label">URL:</span>
                            <a href="#" onClick={(e) => {e.preventDefault(); window.open(url, '_blank')}} className="session-url-link" title={url}>
                              {url}
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
