import React, { useState, useEffect } from 'react'
import { Card, Tag, Button, Space, Typography, Popconfirm, message, Tooltip, Select } from 'antd'
import { PlayCircleOutlined, DeleteOutlined, DownloadOutlined, ReloadOutlined, LoadingOutlined, HistoryOutlined, FileTextOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Project } from '../store/useProjectStore'
import { projectApi } from '../services/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

// 解析日志时间戳格式：2026-04-15 10:03:59,720 -> dayjs
const parseLogTimestamp = (timestamp: string): dayjs.Dayjs | null => {
  if (!timestamp) return null
  // 将逗号分隔的毫秒转换为点分隔
  const normalized = timestamp.replace(',', '.')
  const d = dayjs(normalized)
  return d.isValid() ? d : null
}

const { Text } = Typography

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
  onRetry?: (id: string) => void
  onClick?: () => void
}

interface LogEntry {
  timestamp: string
  module: string
  level: string
  message: string
}

type LogTypeFilter = 'key' | 'all' | 'error'

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onRetry, onClick }) => {
  const navigate = useNavigate()
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentLogIndex, setCurrentLogIndex] = useState(0)
  const [showLogHistory, setShowLogHistory] = useState(false)  // 是否展开历史日志
  const [logTypeFilter, setLogTypeFilter] = useState<LogTypeFilter>('key')  // 日志类型筛选
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  // 获取分类信息
  const getCategoryInfo = (category?: string) => {
    const categoryMap: Record<string, { name: string; icon: string; color: string }> = {
      'default': { name: '默认', icon: '🎬', color: '#4facfe' },
      'knowledge': { name: '知识科普', icon: '📚', color: '#52c41a' },
      'business': { name: '商业财经', icon: '💼', color: '#faad14' },
      'opinion': { name: '观点评论', icon: '💭', color: '#722ed1' },
      'experience': { name: '经验分享', icon: '🌟', color: '#13c2c2' },
      'speech': { name: '演讲脱口秀', icon: '🎤', color: '#eb2f96' },
      'content_review': { name: '内容解说', icon: '🎭', color: '#f5222d' },
      'entertainment': { name: '娱乐内容', icon: '🎪', color: '#fa8c16' }
    }
    return categoryMap[category || 'default'] || categoryMap['default']
  }

  // 缩略图缓存管理
  const thumbnailCacheKey = `thumbnail_${project.id}`
  
  // 生成项目视频缩略图（带缓存）
  useEffect(() => {
    const generateThumbnail = async () => {
      if (!project.video_path) return
      
      // 检查缓存
      const cachedThumbnail = localStorage.getItem(thumbnailCacheKey)
      if (cachedThumbnail) {
        setVideoThumbnail(cachedThumbnail)
        return
      }
      
      setThumbnailLoading(true)
      
      try {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        
        const videoUrl = projectApi.getProjectFileUrl(project.id, 'input/input.mp4')
        
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(5, video.duration / 4) // 取视频1/4处或5秒处的帧
        }
        
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            
            // 设置合适的缩略图尺寸
            const maxWidth = 320
            const maxHeight = 180
            const aspectRatio = video.videoWidth / video.videoHeight
            
            let width = maxWidth
            let height = maxHeight
            
            if (aspectRatio > maxWidth / maxHeight) {
              height = maxWidth / aspectRatio
            } else {
              width = maxHeight * aspectRatio
            }
            
            canvas.width = width
            canvas.height = height
            ctx.drawImage(video, 0, 0, width, height)
            
            const thumbnail = canvas.toDataURL('image/jpeg', 0.7)
            setVideoThumbnail(thumbnail)
            
            // 缓存缩略图
            try {
              localStorage.setItem(thumbnailCacheKey, thumbnail)
            } catch (e) {
              // 如果localStorage空间不足，清理旧缓存
              const keys = Object.keys(localStorage).filter(key => key.startsWith('thumbnail_'))
              if (keys.length > 50) { // 保留最多50个缩略图缓存
                keys.slice(0, 10).forEach(key => localStorage.removeItem(key))
                localStorage.setItem(thumbnailCacheKey, thumbnail)
              }
            }
          } catch (error) {
            console.error('生成缩略图失败:', error)
          } finally {
            setThumbnailLoading(false)
          }
        }
        
        video.onerror = (error) => {
          console.error('视频加载失败:', error)
          setThumbnailLoading(false)
        }
        
        video.src = videoUrl
      } catch (error) {
        console.error('生成缩略图时发生错误:', error)
        setThumbnailLoading(false)
      }
    }
    
    generateThumbnail()
  }, [project.id, project.video_path, thumbnailCacheKey])

  // 获取项目日志（处理中自动获取，或者用户点击查看历史时获取）
  useEffect(() => {
    // 只有在 processing 状态或者用户主动查看历史时才获取日志
    if (project.status !== 'processing' && !showLogHistory) {
      return
    }

    const fetchLogs = async () => {
      setIsLoadingLogs(true)
      try {
        // 后端已经按 project_id 过滤并支持 logType 参数，这里不再做前端过滤
        const response = await projectApi.getProjectLogs(project.id, 20, logTypeFilter)
        setLogs(response.logs)
        // 如果有日志，重置到最新一条
        if (response.logs.length > 0) {
          setCurrentLogIndex(response.logs.length - 1)
        }
      } catch (error) {
        console.error('获取日志失败:', error)
      } finally {
        setIsLoadingLogs(false)
      }
    }

    // 立即获取一次
    fetchLogs()
    
    // 处理中时每3秒更新一次日志
    if (project.status === 'processing') {
      const logInterval = setInterval(fetchLogs, 3000)
      return () => clearInterval(logInterval)
    }
  }, [project.id, project.status, showLogHistory, logTypeFilter])

  // 日志轮播（仅在处理中时自动轮播）
  useEffect(() => {
    if (logs.length <= 1 || project.status !== 'processing') return
    
    const interval = setInterval(() => {
      setCurrentLogIndex(prev => (prev + 1) % logs.length)
    }, 2000) // 每2秒切换一条日志
    
    return () => clearInterval(interval)
  }, [logs.length, project.status])





  const handleRetry = async () => {
    if (isRetrying) return
    
    setIsRetrying(true)
    try {
      await projectApi.retryProcessing(project.id)
      message.success('已开始重试处理项目')
      if (onRetry) {
        onRetry(project.id)
      }
    } catch (error) {
      console.error('重试失败:', error)
      message.error('重试失败，请稍后再试')
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <Card
      hoverable
      className="project-card"
      style={{ 
        width: 200, 
        height: 240,
        borderRadius: '4px',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #1e1e1e 0%, #2a2a2a 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        marginBottom: '0px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}
      bodyStyle={{
        padding: '12px',
        background: 'transparent',
        height: 'calc(100% - 120px)',
        display: 'flex',
        flexDirection: 'column'
      }}
      cover={
        <div 
          style={{ 
            height: 120, 
            position: 'relative',
            background: videoThumbnail 
              ? `url(${videoThumbnail}) center/cover` 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
          onClick={() => {
            if (onClick) {
              onClick()
            } else {
              navigate(`/project/${project.id}`)
            }
          }}
        >
          {/* 缩略图加载状态 */}
          {thumbnailLoading && (
            <div style={{ 
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              <LoadingOutlined 
                style={{ 
                  fontSize: '24px', 
                  marginBottom: '4px'
                }} 
              />
              <div style={{ 
                fontSize: '12px',
                fontWeight: 500
              }}>
                生成封面中...
              </div>
            </div>
          )}
          
          {/* 无缩略图时的默认显示 */}
          {!videoThumbnail && !thumbnailLoading && (
            <div style={{ textAlign: 'center' }}>
              <PlayCircleOutlined 
                style={{ 
                  fontSize: '40px', 
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '4px',
                  filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
                }} 
              />
              <div style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '12px',
                fontWeight: 500
              }}>
                点击预览
              </div>
            </div>
          )}
          
          {/* 分类标签 - 左上角 */}
          {project.video_category && project.video_category !== 'default' && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px'
            }}>
              <Tag
                style={{
                  background: `${getCategoryInfo(project.video_category).color}15`,
                  border: `1px solid ${getCategoryInfo(project.video_category).color}40`,
                  borderRadius: '3px',
                  color: getCategoryInfo(project.video_category).color,
                  fontSize: '10px',
                  fontWeight: 500,
                  padding: '2px 6px',
                  lineHeight: '14px',
                  height: '18px',
                  margin: 0
                }}
              >
                <span style={{ marginRight: '2px' }}>{getCategoryInfo(project.video_category).icon}</span>
                {getCategoryInfo(project.video_category).name}
              </Tag>
            </div>
          )}
          
          {/* 移除右上角状态指示器 - 可读性差且冗余 */}
          
          {/* 更新时间和操作按钮 - 移动到封面底部 */}
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0',
            padding: '6px 8px',
            height: '28px'
          }}>
            <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
              {dayjs(project.updated_at).fromNow()}
            </Text>
            
            {/* 操作按钮 */}
            <div 
              className="card-action-buttons"
              style={{
                display: 'flex',
                gap: '4px',
                opacity: 0,
                transition: 'opacity 0.3s ease'
              }}
            >
              {/* 失败状态：只显示重试和删除按钮 */}
              {project.status === 'error' ? (
                <>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={isRetrying}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRetry()
                    }}
                    style={{
                      height: '20px',
                      width: '20px',
                      borderRadius: '3px',
                      color: '#52c41a',
                      border: '1px solid rgba(82, 196, 26, 0.5)',
                      background: 'rgba(82, 196, 26, 0.1)',
                      padding: 0,
                      minWidth: '20px',
                      fontSize: '10px'
                    }}
                  />
                  
                  <Popconfirm
                    title="确定要删除这个项目吗？"
                    description="删除后无法恢复"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      onDelete(project.id)
                    }}
                    onCancel={(e) => {
                      e?.stopPropagation()
                    }}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      style={{
                        height: '20px',
                        width: '20px',
                        borderRadius: '3px',
                        color: '#ff6b6b',
                        border: '1px solid rgba(255, 107, 107, 0.5)',
                        background: 'rgba(255, 107, 107, 0.1)',
                        padding: 0,
                        minWidth: '20px',
                        fontSize: '10px'
                      }}
                    />
                  </Popconfirm>
                </>
              ) : (
                /* 其他状态：显示下载和删除按钮 */
                <>
                  <Space size={4}>
                    {/* 下载按钮 - 仅在完成状态显示 */}
                    {project.status === 'completed' && (
                      <Tooltip title="打包下载所有文件" placement="top">
                        <Button
                          type="text"
                          icon={<DownloadOutlined />}
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              message.loading('正在打包下载...', 0)
                              await projectApi.downloadProjectAll(project.id)
                              message.destroy()
                              message.success('下载完成！')
                            } catch (error) {
                              message.destroy()
                              console.error('下载失败:', error)
                              message.error('下载失败，请稍后再试')
                            }
                          }}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            color: 'rgba(255, 255, 255, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: 0,
                            minWidth: '20px',
                            fontSize: '10px'
                          }}
                        />
                      </Tooltip>
                    )}
                    
                    {/* 删除按钮 */}
                    <Popconfirm
                      title="确定要删除这个项目吗？"
                      description="删除后无法恢复"
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        onDelete(project.id)
                      }}
                      onCancel={(e) => {
                        e?.stopPropagation()
                      }}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          color: 'rgba(255, 255, 255, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.1)',
                          padding: 0,
                          minWidth: '20px',
                          fontSize: '10px'
                        }}
                      />
                    </Popconfirm>
                  </Space>
                 </>
               )}
            </div>
          </div>
        </div>
      }
    >
      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* 日志展示区域 */}
          {project.status === 'processing' ? (
            // 处理中：显示实时日志轮播
            logs.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '3px',
                  padding: '6px 8px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  <LoadingOutlined style={{ color: '#667eea', fontSize: '12px' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Text style={{ 
                      fontSize: '10px', 
                      color: '#ffffff',
                      lineHeight: '12px',
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {logs[currentLogIndex]?.message || '正在处理...'}
                    </Text>
                    <Text style={{ 
                      fontSize: '9px', 
                      color: '#999999',
                      lineHeight: '10px'
                    }}>
                      {logs[currentLogIndex]?.timestamp ?
                        parseLogTimestamp(logs[currentLogIndex].timestamp)?.format('HH:mm:ss') || logs[currentLogIndex].timestamp.split(' ')[1]?.split(',')[0] || '' :
                        ''
                      }
                    </Text>
                  </div>
                  {logs.length > 1 && (
                    <div style={{
                      display: 'flex',
                      gap: '2px'
                    }}>
                      {logs.slice(0, Math.min(3, logs.length)).map((_, index) => (
                        <div
                          key={index}
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: index === currentLogIndex % Math.min(3, logs.length) ? '#667eea' : 'rgba(255, 255, 255, 0.3)',
                            transition: 'background 0.3s'
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            // 非处理中：显示"查看历史日志"按钮
            <div style={{ marginBottom: '8px' }}>
              {!showLogHistory ? (
                // 收起状态：显示按钮
                <Button
                  type="text"
                  size="small"
                  icon={isLoadingLogs ? <LoadingOutlined /> : <HistoryOutlined />}
                  onClick={() => setShowLogHistory(true)}
                  style={{
                    width: '100%',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    color: '#667eea',
                    background: 'rgba(102, 126, 234, 0.1)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    borderRadius: '3px',
                    fontSize: '10px'
                  }}
                >
                  查看历史日志
                </Button>
              ) : (
                // 展开状态：显示历史日志
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '3px',
                  padding: '6px 8px',
                  border: '1px solid rgba(102, 126, 234, 0.2)'
                }}>
                  {/* 头部：标题 + 筛选 + 关闭按钮 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '6px'
                  }}>
                    <FileTextOutlined style={{ color: '#667eea', fontSize: '11px' }} />
                    <Text style={{ fontSize: '10px', color: '#667eea', flex: 1 }}>
                      项目日志
                    </Text>
                    {/* 日志类型筛选 */}
                    <Select
                      size="small"
                      value={logTypeFilter}
                      onChange={setLogTypeFilter}
                      style={{ width: 70, fontSize: '10px' }}
                      options={[
                        { value: 'key', label: '关键', title: '关键步骤' },
                        { value: 'all', label: '全部', title: '全部日志' },
                        { value: 'error', label: '错误', title: '仅错误' }
                      ]}
                    />
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setShowLogHistory(false)
                        setLogs([])
                      }}
                      style={{ 
                        color: '#999', 
                        padding: '0 4px', 
                        height: '20px',
                        minWidth: '20px'
                      }}
                    >
                      ✕
                    </Button>
                  </div>
                  
                  {/* 日志列表 */}
                  {isLoadingLogs ? (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <LoadingOutlined style={{ color: '#667eea' }} />
                    </div>
                  ) : logs.length === 0 ? (
                    <Text style={{ fontSize: '10px', color: '#666', display: 'block', textAlign: 'center', padding: '4px 0' }}>
                      暂无日志记录
                    </Text>
                  ) : (
                    <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                      {logs.slice(-5).reverse().map((log, index) => (
                        <div 
                          key={index} 
                          style={{
                            padding: '3px 0',
                            borderBottom: index < Math.min(5, logs.length) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                          }}
                        >
                          <Text style={{
                            fontSize: '9px',
                            color: log.level === 'ERROR' ? '#ff4d4f' : '#ccc',
                            display: 'block',
                            lineHeight: '12px',
                            wordBreak: 'break-all'
                          }}>
                            {/* 错误日志显示完整消息，其他日志截断显示 */}
                            {(log.level === 'ERROR' || log.level === 'WARNING') && log.message.length > 50
                              ? log.message
                              : (log.message.length > 50 ? log.message.substring(0, 50) + '...' : log.message)}
                          </Text>
                          <Text style={{ fontSize: '8px', color: '#666' }}>
                            {log.timestamp ? (parseLogTimestamp(log.timestamp)?.format('HH:mm:ss') || log.timestamp.split(' ')[1]?.split(',')[0] || '') : ''}
                            {log.level !== 'INFO' && ` • ${log.level}`}
                          </Text>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* 项目名称 */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <Tooltip title={project.name} placement="top">
              <Text 
                strong 
                style={{ 
                  fontSize: '13px', 
                  color: '#ffffff',
                  fontWeight: 600,
                  lineHeight: '16px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'help',
                  height: '32px'
                }}
              >
                {project.name}
              </Text>
            </Tooltip>
          </div>
          
          {/* 状态和统计信息 */}
          <div style={{ 
            display: 'flex', 
            gap: '6px'
          }}>
            {/* 状态显示 */}
            <div style={{
              background: project.status === 'completed' ? 'rgba(82, 196, 26, 0.15)' :
                         project.status === 'processing' ? 'rgba(24, 144, 255, 0.15)' :
                         project.status === 'error' ? 'rgba(255, 77, 79, 0.15)' :
                         'rgba(217, 217, 217, 0.15)',
              border: project.status === 'completed' ? '1px solid rgba(82, 196, 26, 0.3)' :
                      project.status === 'processing' ? '1px solid rgba(24, 144, 255, 0.3)' :
                      project.status === 'error' ? '1px solid rgba(255, 77, 79, 0.3)' :
                      '1px solid rgba(217, 217, 217, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ 
                color: project.status === 'completed' ? '#52c41a' :
                       project.status === 'processing' ? '#1890ff' :
                       project.status === 'error' ? '#ff4d4f' :
                       '#d9d9d9',
                fontSize: '12px', 
                fontWeight: 600, 
                lineHeight: '14px' 
              }}>
                {project.status === 'processing' && project.current_step && project.total_steps 
                  ? `${Math.round((project.current_step / project.total_steps) * 100)}%`
                  : project.status === 'completed' ? '✓'
                  : project.status === 'error' ? '✗'
                  : '○'
                }
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                {project.status === 'completed' ? '已完成' :
                 project.status === 'processing' ? '处理中' :
                 project.status === 'error' ? '失败' :
                 '等待中'
                }
              </div>
            </div>

            {/* 查看日志按钮 - 所有状态都可见 */}
            <Tooltip title="查看完整日志">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLogHistory(true)
                }}
                style={{
                  background: 'rgba(102, 126, 234, 0.15)',
                  border: '1px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: '3px',
                  padding: '4px 6px',
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '36px'
                }}
              >
                <span style={{ color: '#667eea', fontSize: '12px', fontWeight: 600, lineHeight: '14px' }}>
                  <EyeOutlined />
                </span>
                <span style={{ color: '#999999', fontSize: '9px', lineHeight: '10px', marginTop: '2px' }}>
                  日志
                </span>
              </Button>
            </Tooltip>
            
            {/* 切片数量 */}
            <div style={{
              background: 'rgba(102, 126, 234, 0.15)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ color: '#667eea', fontSize: '12px', fontWeight: 600, lineHeight: '14px' }}>
                {project.clips?.length || 0}
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                切片
              </div>
            </div>
            
            {/* 合集数量 */}
            <div style={{
              background: 'rgba(118, 75, 162, 0.15)',
              border: '1px solid rgba(118, 75, 162, 0.3)',
              borderRadius: '3px',
              padding: '4px 6px',
              textAlign: 'center',
              flex: 1
            }}>
              <div style={{ color: '#764ba2', fontSize: '12px', fontWeight: 600, lineHeight: '14px' }}>
                {project.collections?.length || 0}
              </div>
              <div style={{ color: '#999999', fontSize: '9px', lineHeight: '10px' }}>
                合集
              </div>
            </div>
          </div>

        </div>
      </div>
    </Card>
  )
}

export default ProjectCard