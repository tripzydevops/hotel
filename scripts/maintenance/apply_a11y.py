import re
import os

def process_hotel_tile():
    path = "components/tiles/HotelTile.tsx"
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    target = '<motion.div\n      whileHover={{ y: -5 }}'
    replacement = '''<motion.div
      tabIndex={0}
      role="button"
      aria-label={`View details for ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetails?.(props as any);
        }
      }}
      whileHover={{ y: -5 }}'''
    
    if target in content and 'role="button"' not in content:
        content = content.replace(target, replacement)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated HotelTile.tsx")

def process_hotel_modal():
    path = "components/modals/HotelDetailsModal.tsx"
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Dialog roles and focus trap
    target1 = 'className="w-full max-w-[90vw] md:max-w-[1200px] h-[90vh] bg-[var(--deep-ocean)]'
    replacement1 = 'role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} autoFocus className="w-full max-w-[90vw] md:max-w-[1200px] h-[90vh] bg-[var(--deep-ocean)]'
    
    if target1 in content and 'role="dialog"' not in content:
        content = content.replace(target1, replacement1)
        print("Updated modal dialog roles")
        
    # 2. Add id="modal-title" to the h2
    target2 = '<h2 className="text-2xl font-black'
    replacement2 = '<h2 id="modal-title" className="text-2xl font-black'
    if target2 in content and 'id="modal-title"' not in content:
        content = content.replace(target2, replacement2)
        print("Updated modal title ID")

    # 3. Tablist and tabs
    target3 = '<div className="flex px-8 border-b border-[var(--glass-border)]'
    replacement3 = '<div role="tablist" aria-label="Hotel details tabs" className="flex px-8 border-b border-[var(--glass-border)]'
    if target3 in content and 'role="tablist"' not in content:
        content = content.replace(target3, replacement3)
        print("Updated tablist role")

    # 4. Tab buttons
    target4 = '<button\n              type="button"\n              key={tab.id}'
    replacement4 = '''<button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}'''
    if target4 in content and 'role="tab"' not in content:
        content = content.replace(target4, replacement4)
        print("Updated tab button roles")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def process_tab_panels():
    tabs = ["Overview", "Rooms", "Reviews", "Offers", "Gallery", "Amenities"]
    for tab in tabs:
        path = f"components/modals/tabs/Tab{tab}.tsx"
        if not os.path.exists(path): continue
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        
        target = '<motion.div\n      initial='
        replacement = f'<motion.div\n      role="tabpanel"\n      id="panel-{tab.lower()}"\n      aria-labelledby="tab-{tab.lower()}"\n      initial='
        if target in content and 'role="tabpanel"' not in content:
            content = content.replace(target, replacement, 1)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated Tab{tab}.tsx")

def process_analysis_page():
    path = "app/(dashboard)/analysis/page.tsx"
    if not os.path.exists(path):
        path = "analysis_page_frontend.tsx"
    
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    target = '<div className="min-h-screen bg-[var(--deep-ocean)] text-white p-6">'
    replacement = '''<div className="min-h-screen bg-[var(--deep-ocean)] text-white p-6">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:p-4 focus:bg-[var(--soft-gold)] focus:text-[var(--deep-ocean)] focus:z-50 font-bold rounded outline-none border-2 border-[var(--soft-gold)]">
        Skip to main content
      </a>'''
      
    target2 = '<div className="max-w-[1600px] mx-auto space-y-6">'
    replacement2 = '<main id="main-content" tabIndex={-1} className="max-w-[1600px] mx-auto space-y-6 outline-none">'
    
    if target in content and "Skip to main content" not in content:
        content = content.replace(target, replacement)
        if target2 in content:
            content = content.replace(target2, replacement2)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated Analysis Page (Skip Link)")

def process_score_card():
    path = "components/ui/sentiment/ScoreCard.tsx"
    if not os.path.exists(path): return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if '<div className="text-4xl font-black text-[var(--text-primary)]">' in content and 'aria-label=' not in content:
        content = content.replace(
            '<div className="text-4xl font-black text-[var(--text-primary)]">',
            '<div className="text-4xl font-black text-[var(--text-primary)]" aria-label={`Score: ${score}`}>\n        <span className="sr-only">Score: </span>'
        )
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated ScoreCard.tsx")

process_hotel_tile()
process_hotel_modal()
process_tab_panels()
process_analysis_page()
process_score_card()
