import { useState, useCallback } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'
import PlanCanvas from './PlanCanvas'
import ModelingToolbar from './ModelingToolbar'
import MemberPropertiesPanel from './MemberPropertiesPanel'
import StorySelector from './StorySelector'

export type DrawingTool =
  | 'select'
  | 'column'
  | 'beam'
  | 'slab'
  | 'wall'

export default function ModelingModule() {
  const { project } = useProjectStore()
  const { activeStoryIndex } = useUIStore()
  const [activeTool, setActiveTool] = useState<DrawingTool>('select')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedMemberType, setSelectedMemberType] = useState<string | null>(null)

  if (!project) return null

  const activeStory = project.grid.stories[activeStoryIndex] ?? null

  function handleMemberSelect(id: string, type: string) {
    setSelectedMemberId(id)
    setSelectedMemberType(type)
    setActiveTool('select')
  }

  function handleCanvasClick() {
    if (activeTool === 'select') {
      setSelectedMemberId(null)
      setSelectedMemberType(null)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#ffffff]">
      {/* Top toolbar */}
      <ModelingToolbar
        activeTool={activeTool}
        onToolChange={(tool) => {
          setActiveTool(tool)
          setSelectedMemberId(null)
          setSelectedMemberType(null)
        }}
      />

      <div className="flex flex-1 min-h-0">
        {/* Canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Story selector */}
          <StorySelector />

          {/* Canvas */}
          <div className="flex-1 relative">
            {project.grid.stories.length === 0 || project.grid.xLines.length < 2 ? (
              <EmptyGridNotice />
            ) : (
              <PlanCanvas
                activeTool={activeTool}
                activeStory={activeStory}
                selectedMemberId={selectedMemberId}
                onMemberSelect={handleMemberSelect}
                onCanvasClick={handleCanvasClick}
              />
            )}
          </div>
        </div>

        {/* Right panel — member properties */}
        {selectedMemberId && selectedMemberType && (
          <MemberPropertiesPanel
            memberId={selectedMemberId}
            memberType={selectedMemberType}
            onClose={() => {
              setSelectedMemberId(null)
              setSelectedMemberType(null)
            }}
          />
        )}
      </div>

      {/* Status bar */}
      <StatusBar activeTool={activeTool} activeStory={activeStory} project={project} />
    </div>
  )
}

function EmptyGridNotice() {
  const { setActiveModule } = useUIStore()
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="text-5xl">⊞</div>
      <h3 className="text-gray-700 font-mono font-bold">No Grid Defined</h3>
      <p className="text-gray-500 font-mono text-sm max-w-xs">
        Add grid lines and stories from Project Setup before starting modeling
      </p>
      <button
        onClick={() => setActiveModule('project_setup')}
        className="px-6 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-600 font-mono text-sm hover:bg-red-500/30 transition-all"
      >
        ⚙ Go to Project Setup
      </button>
    </div>
  )
}

function StatusBar({
  activeTool,
  activeStory,
  project,
}: {
  activeTool: DrawingTool
  activeStory: any
  project: any
}) {
  const toolLabels: Record<DrawingTool, string> = {
    select: 'Select Mode',
    column: 'Placing column — click on a grid point',
    beam: 'Drawing beam — click the start point',
    slab: 'Slab — (Phase 3)',
    wall: 'Wall — (Phase 3)',
  }

  const cols = project.members.columns.filter((c: any) => c.storyId === activeStory?.id).length
  const beams = project.members.beams.filter((b: any) => b.storyId === activeStory?.id).length

  return (
    <div className="h-8 border-t border-[#e5e7eb] bg-[#ffffff] flex items-center px-4 gap-6 text-xs font-mono text-gray-500 shrink-0">
      <span className="text-gray-500">{toolLabels[activeTool]}</span>
      <span className="ml-auto">Story: {activeStory?.label ?? '—'}</span>
      <span>Columns: {cols}</span>
      <span>Beams: {beams}</span>
      <span>Total Columns: {project.members.columns.length}</span>
    </div>
  )
}
