import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'

export default function StorySelector() {
  const { project } = useProjectStore()
  const { activeStoryIndex, setActiveStoryIndex } = useUIStore()

  if (!project || project.grid.stories.length === 0) return null

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-[#1e2d4a] bg-[#080d1a] overflow-x-auto shrink-0">
      <span className="text-slate-600 text-xs font-mono mr-2 shrink-0">তলা:</span>
      {project.grid.stories.map((story, index) => {
        const isActive = activeStoryIndex === index
        const memberCount =
          project.members.columns.filter(c => c.storyId === story.id).length +
          project.members.beams.filter(b => b.storyId === story.id).length

        return (
          <button
            key={story.id}
            onClick={() => setActiveStoryIndex(index)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono
              border shrink-0 transition-all
              ${isActive
                ? 'border-red-500/50 bg-red-500/15 text-red-400'
                : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }
            `}
          >
            <span className="font-semibold">{story.label}</span>
            <span className="opacity-50">
              {(story.level / 1000).toFixed(1)}m
            </span>
            {memberCount > 0 && (
              <span
                className="text-xs rounded-full px-1.5"
                style={{
                  background: isActive ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.2)',
                  color: isActive ? '#fca5a5' : '#64748b',
                }}
              >
                {memberCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
