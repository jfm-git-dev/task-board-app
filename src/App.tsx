import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'

/**
 * Type Definitions
 * Defines the structure of data objects used throughout the application.
 * Ensures type safety and provides autocomplete support in the IDE.
 */
interface TeamMember {
  id: string
  name: string
  color: string
}

interface Task {
  id: string | number // Supports both UUID and BigInt database types
  title: string
  status: string
  description?: string
  priority?: string
  due_date?: string
  assignee_id?: string
  labels?: string[]
}

interface ActivityLog {
  id: string
  action: string
  created_at: string
}

// Visual configuration for team member avatars
const avatarColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500']

function App() {
  /**
   * Application State
   * Manages data persistence, user sessions, and UI toggles.
   */
  const [session, setSession] = useState<any>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  // Filtering and Search State
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [filterLabel, setFilterLabel] = useState('')

  // Task Detail Modal and History State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  
  // Drag and Drop tracking
  const [draggingTaskId, setDraggingTaskId] = useState<string | number | null>(null)
  
  // Form input states for creating new entities
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('normal')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [labelInput, setLabelInput] = useState('')
  const [newTaskLabels, setNewTaskLabels] = useState<string[]>([])

  /**
   * Data Fetching Logic
   * Retrieves the latest state from Supabase tables.
   */
  const fetchData = async () => {
    // Fetches all tasks ordered by creation date
    const { data: taskData } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (taskData) setTasks(taskData)

    // Fetches all team members associated with the current project
    const { data: teamData } = await supabase.from('team_members').select('*')
    if (teamData) setTeamMembers(teamData)
  }

  /**
   * Lifecycle Management
   * Handles initial authentication and data synchronization on component mount.
   */
  useEffect(() => {
    const initializeGuest = async () => {
      // Attempts to retrieve an existing session from local storage
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      
      if (existingSession) {
        setSession(existingSession)
        fetchData()
      } else {
        // Automatically signs in as an anonymous guest if no session exists
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error) {
          setSession(data.session)
          fetchData()
        }
      }
    }
    initializeGuest()
  }, [])

  /**
   * Activity Logging
   * Records state changes (creation, movement) into the activity_logs table for audit trails.
   */
  const logActivity = async (taskId: string | number, actionText: string) => {
    await supabase.from('activity_logs').insert([{ task_id: taskId, action: actionText }])
  }

  /**
   * Task Detail Handler
   * Triggers the modal view and fetches historical activity for a specific task.
   */
  const handleTaskClick = async (task: Task) => {
    setSelectedTask(task)
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: false })
    setActivityLogs(data || [])
  }

  /**
   * Event Handlers
   * Manages Form submissions and interactive UI updates.
   */
  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemberName.trim() || !session) return
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)]
    
    // Inserts new team member with a randomly assigned UI color
    const { error } = await supabase.from('team_members').insert([{ 
      name: newMemberName, 
      color: randomColor, 
      user_id: session.user.id 
    }])
    if (!error) { setNewMemberName(''); fetchData() }
  }

  const handleAddLabel = (e: React.MouseEvent) => {
    e.preventDefault()
    if (labelInput.trim() && !newTaskLabels.includes(labelInput.trim())) {
      setNewTaskLabels([...newTaskLabels, labelInput.trim()])
      setLabelInput('')
    }
  }

  const removeDraftLabel = (labelToRemove: string) => {
    setNewTaskLabels(newTaskLabels.filter(lbl => lbl !== labelToRemove))
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !session) return
    
    // Inserts task into database and retrieves the generated ID for logging
    const { data, error } = await supabase.from('tasks').insert([{ 
      title: newTaskTitle, 
      description: newTaskDescription, 
      priority: newTaskPriority, 
      due_date: newTaskDueDate || null, 
      assignee_id: newTaskAssignee || null,
      labels: newTaskLabels,
      status: 'To Do', 
      user_id: session.user.id 
    }]).select()

    if (!error && data) {
      await logActivity(data[0].id, 'Task created in To Do')
      setNewTaskTitle(''); setNewTaskDescription(''); setNewTaskPriority('normal'); 
      setNewTaskDueDate(''); setNewTaskAssignee(''); setNewTaskLabels([]);
      fetchData()
    }
  }

  /**
   * Drag and Drop Logic
   * Implements native HTML5 Drag-and-Drop API for status updates.
   */
  const handleDrop = async (newStatus: string) => {
    if (!draggingTaskId) return
    const taskBeingMoved = tasks.find(t => t.id === draggingTaskId)
    
    if (taskBeingMoved && taskBeingMoved.status !== newStatus) {
      // Optimistic UI Update: Updates local state immediately for perceived performance
      setTasks(prev => prev.map(t => t.id === draggingTaskId ? { ...t, status: newStatus } : t))
      
      // Persistence: Syncs change to the database
      await supabase.from('tasks').update({ status: newStatus }).eq('id', draggingTaskId)
      
      // Records movement in the activity log
      await logActivity(draggingTaskId, `Moved from ${taskBeingMoved.status} → ${newStatus}`)
    }
    setDraggingTaskId(null)
  }

  /**
   * Memoized Derived State
   * Filters the main task list based on multiple criteria without re-fetching from database.
   * Recalculates only when search terms or filters change.
   */
  const allUniqueLabels = Array.from(new Set(tasks.flatMap(t => t.labels || [])))

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPriority = filterPriority === '' || task.priority === filterPriority
      const matchesAssignee = filterAssignee === '' || task.assignee_id === filterAssignee
      const matchesLabel = filterLabel === '' || (task.labels && task.labels.includes(filterLabel))

      return matchesSearch && matchesPriority && matchesAssignee && matchesLabel
    })
  }, [tasks, searchTerm, filterPriority, filterAssignee, filterLabel])

  // Statistical calculations for the dashboard header
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'Done').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'Done').length
  }

  // Date comparison logic for urgency indicators
  const isOverdue = (date?: string) => {
    if (!date) return false
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return new Date(date) < today
  }

  const columns = ['To Do', 'In Progress', 'In Review', 'Done']

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      
      {/* TASK DETAIL & ACTIVITY MODAL - Conditional Rendering */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedTask.title}</h2>
                <div className="flex gap-2 items-center mt-2">
                  <p className="text-sm text-gray-500">Status: <span className="font-semibold text-gray-800">{selectedTask.status}</span></p>
                  {selectedTask.labels?.map(lbl => (
                    <span key={lbl} className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{lbl}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-black font-bold text-xl cursor-pointer">&times;</button>
            </div>
            
            <h3 className="font-bold text-gray-700 mb-3 uppercase tracking-wider text-xs">Activity History</h3>
            <ul className="space-y-4 relative border-l-2 border-gray-100 ml-2 pl-4">
              {activityLogs.map(log => (
                <li key={log.id} className="relative">
                  <div className="absolute -left-5.25 top-1 h-2 w-2 rounded-full bg-blue-500 ring-4 ring-white"></div>
                  <p className="text-sm font-medium text-gray-800">{log.action}</p>
                  <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Task Roadmap</h1>
            <p className="text-gray-500 mt-1">Real-time workflow management interface.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
              <p className="text-xs text-green-500 uppercase font-bold tracking-widest">Done</p>
              <p className="text-xl font-bold">{stats.completed}</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
              <p className="text-xs text-red-500 uppercase font-bold tracking-widest">Overdue</p>
              <p className="text-xl font-bold">{stats.overdue}</p>
            </div>
          </div>
        </div>

        {/* Team Roster Management */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Team:</span>
            <div className="flex -space-x-2 overflow-hidden">
              {teamMembers.map(member => (
                <div key={member.id} title={member.name} className={`flex items-center justify-center shrink-0 h-8 w-8 rounded-full ring-2 ring-white text-white font-bold text-xs ${member.color}`}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
          <form onSubmit={handleAddTeamMember} className="flex gap-2">
            <input type="text" placeholder="Add teammate..." value={newMemberName} onChange={e => setNewMemberName(e.target.value)} className="p-2 border rounded-md outline-none text-sm bg-gray-50 focus:bg-white" />
            <button type="submit" className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-bold text-sm transition-colors cursor-pointer">+ Add</button>
          </form>
        </div>

        {/* Global Filter Bar */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-50">
            <input type="text" placeholder="🔍 Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 border-b-2 border-transparent focus:border-blue-500 outline-none transition-colors bg-gray-50 rounded text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter:</span>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="p-2 border rounded outline-none text-sm bg-white cursor-pointer">
              <option value="">Any Priority</option>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
            <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="p-2 border rounded outline-none text-sm bg-white cursor-pointer">
              <option value="">Anyone</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterLabel} onChange={e => setFilterLabel(e.target.value)} className="p-2 border rounded outline-none text-sm bg-white cursor-pointer">
              <option value="">Any Label</option>
              {allUniqueLabels.map(lbl => <option key={lbl} value={lbl}>{lbl}</option>)}
            </select>
          </div>
        </div>

        {/* Task Creation Form with Categorized Inputs */}
        <form onSubmit={handleAddTask} className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Task Title</label>
              <input type="text" placeholder="Title" required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full p-2 border-b-2 border-gray-200 focus:border-blue-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Assignee</label>
              <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)} className="w-full p-2 border rounded outline-none text-sm bg-gray-50 cursor-pointer">
                <option value="">Unassigned</option>
                {teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Due Date</label>
              <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full p-2 border rounded outline-none text-sm bg-gray-50" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Labels</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Add tag..." value={labelInput} onChange={e => setLabelInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLabel(e as any)} className="flex-1 p-2 border rounded outline-none text-sm bg-gray-50" />
                <button onClick={handleAddLabel} className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm font-bold hover:bg-gray-300 transition-colors">Add</button>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {newTaskLabels.map(lbl => (
                  <span key={lbl} className="bg-blue-100 text-blue-800 text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1">
                    {lbl} <button type="button" onClick={() => removeDraftLabel(lbl)} className="hover:text-red-500">&times;</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Priority</label>
              <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="w-full p-2 border rounded outline-none text-sm bg-gray-50 cursor-pointer">
                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-gray-900 text-white p-2 rounded-md font-bold hover:bg-black transition-all cursor-pointer h-9.5">Create Task</button>
          </div>
        </form>

        {/* Kanban Board Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {columns.map(columnName => (
            <div key={columnName} className="bg-gray-100 rounded-xl p-4 min-h-150" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(columnName)}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-600 uppercase text-xs tracking-widest">{columnName}</h2>
                <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-xs font-bold">
                  {filteredTasks.filter(t => t.status === columnName).length}
                </span>
              </div>
              
              {filteredTasks.filter(t => t.status === columnName).map(task => {
                const assignee = teamMembers.find(m => m.id === task.assignee_id)

                return (
                  <div 
                    key={task.id} 
                    draggable 
                    onDragStart={() => setDraggingTaskId(task.id)} 
                    onClick={() => handleTaskClick(task)}
                    className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    {/* UI Rendering: Labels */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.labels?.map(lbl => (
                        <span key={lbl} className="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">{lbl}</span>
                      ))}
                    </div>

                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-600' : task.priority === 'low' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        {task.priority}
                      </span>
                      {task.due_date && (
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${isOverdue(task.due_date) && task.status !== 'Done' ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                          {isOverdue(task.due_date) && task.status !== 'Done' ? '⚠️ OVERDUE' : task.due_date}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-gray-800 text-sm mb-1">{task.title}</h3>
                    {task.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>}

                    {/* UI Rendering: Assignee Avatar */}
                    {assignee && (
                      <div className="flex justify-end border-t border-gray-100 pt-3 mt-2">
                        <div title={`Assigned to ${assignee.name}`} className={`flex items-center justify-center shrink-0 h-6 w-6 rounded-full text-white font-bold text-[10px] ${assignee.color}`}>
                          {assignee.name.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App