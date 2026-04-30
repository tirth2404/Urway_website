import React, {useMemo} from 'react'

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

export default function ActivityList({sites=[], totalBrowserDuration=0, onDomainClick}){
  if(!sites || sites.length===0) return (<div className="empty-state">No activities yet</div>)

  // Combine server site documents by domain so multiple docs for the same domain
  // aggregate into a single group (e.g., youtube.com should be one heading)
  const grouped = useMemo(()=>{
    const normalizeDomain = (domain, url) => {
      let d = domain || ''
      if (!d && url){
        try { d = (new URL(url)).hostname } catch(e) { d = '' }
      }
      d = String(d || 'Unknown').toLowerCase().trim()
      if (d.startsWith('www.')) d = d.slice(4)
      return d || 'Unknown'
    }

    const m = new Map()
    for (const s of sites){
      const domain = normalizeDomain(s.domain, s.url)
      // Enrich each segment with site-level title/url when segment doesn't include them
      const items = (s.segments || []).map(seg => ({
        ...seg,
        title: seg.title || s.title || seg.unencryptedData?.title || null,
        url: seg.url || s.url || seg.unencryptedData?.url || null
      }))
      const total = Number(s.total || 0)
      if (m.has(domain)){
        const existing = m.get(domain)
        // merge items and totals; keep existing title/url (segments still carry their own data)
        existing.items.push(...items)
        existing.total = (existing.total || 0) + total
      } else {
        m.set(domain, { domain, items: [...items], total, title: s.title, url: s.url })
      }
    }
    const arr = Array.from(m.values())
    arr.sort((a,b)=>b.total - a.total)
    return arr
  }, [sites])

  return (
    <div className="grouped-list">
      {grouped.map((g, idx) => {
        return (
          <div key={g.domain} className="website-group" onClick={() => onDomainClick && onDomainClick(g.domain)}>
            <div className="website-header">
              <div className="website-info">
                <span className="domain-badge">{g.domain}</span>
                <span className="group-duration">{formatDuration(g.total)}</span>
              </div>
              <div className="expand-toggle">▶</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
