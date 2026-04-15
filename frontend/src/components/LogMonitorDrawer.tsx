import React, { useState, useEffect, useRef } from 'react'
import { Drawer, Button, Select, Space, Empty, Spin, Tag, Tooltip, Popconfirm, message } from 'antd'
import { FileTextOutlined, ClearOutlined, ReloadOutlined, StopOutlined, PlayCircleOutlined } from '@ant-design/icons'
import api from '../services/api'

interface LogEntry {
  timestamp: string
  module: string
  level: string
  message: string
  project_id?: string
}

interface ProjectLogInfo {
  name: string
  status: string
}

interface LogMonitorDrawerProps {
  visible: boolean
  onClose: () => void
}

const LogMonitorDrawer: React.FC<LogMonitorDrawerProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [totalLines, setTotalLines] = useState(0)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // 获取日志列表
  const fetchLogs = async () => {
    setLoading(true)
    try {
      let result
      if (selectedProject) {
        result = await api.getRealtimeLogs(selectedProject, 200)
      } else {
        result = await api.getRealtimeLogs(undefined, 200)
      }
      setLogs(result.lines.map((line: string) => parseLogLine(line)))
      setTotalLines(result.total_lines)
    } catch (error) {
      console.error('获取日志失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 解析日志行
  const parseLogLine = (line: string): LogEntry => {
    const parts = line.split(' - ', 3)
    if (parts.length >= 3) {
      return {
        timestamp: parts[0],
        module: parts[1],
        level: parts[2],
        message: parts.slice(3).join(' - '),
        project_id: extractProjectId(line)
      }
    }
    return {
      timestamp: '',
      module: '',
      level: 'INFO',
      message: line
    }
  }

  // 从日志行中提取项目ID
  const extractProjectId = (line: string): string | undefined => {
    const match = line.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)
    return match ? match[1] : undefined
  }

  // 获取日志级别颜色
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'red'
      case 'WARNING': return 'orange'
      case 'INFO': return 'blue'
      case 'DEBUG': return 'gray'
      default: return 'default'
    }
  }

  // 清空日志
  const handleClearLogs = async () => {
    try {
      if (selectedProject) {
        await api.deleteProjectLogs(selectedProject)
        message.success('已清理该项目日志')
      } else {
        const result = await api.clearOldLogs()
        message.success(result.message)
      }
      fetchLogs()
    } catch (error) {
      message.error('清理日志失败')
    }
  }

  // 切换自动刷新
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  // 自动刷新日志
  useEffect(() => {
    if (autoRefresh) {
      pollingRef.current = setInterval(fetchLogs, 2000) // 每2秒刷新一次
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [autoRefresh, selectedProject])

  // 初始加载和项目切换时获取日志
  useEffect(() => {
    if (visible) {
      fetchLogs()
    }
  }, [visible, selectedProject])

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileTextOutlined />
          <span>日志监控</span>
          <Tag color={autoRefresh ? 'green' : 'default'}>
            {autoRefresh ? '实时' : '已暂停'}
          </Tag>
          <Tag color="blue">{totalLines} 行</Tag>
        </div>
      }
      placement="bottom"
      height={450}
      open={visible}
      onClose={onClose}
      extra={
        <Space>
          <Select
            placeholder="选择项目（可选）"
            allowClear
            style={{ width: 200 }}
            onChange={(value) => setSelectedProject(value)}
            options={[]}
          />
          <Tooltip title={autoRefresh ? '暂停实时刷新' : '开启实时刷新'}>
            <Button
              icon={autoRefresh ? <StopOutlined /> : <PlayCircleOutlined />}
              onClick={toggleAutoRefresh}
              type={autoRefresh ? 'primary' : 'default'}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} />
          </Tooltip>
          <Popconfirm
            title="确定要清空日志吗？"
            description="将保留最近5个任务的日志"
            onConfirm={handleClearLogs}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="清空日志">
              <Button icon={<ClearOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      }
    >
      <div
        ref={logContainerRef}
        style={{
          height: 'calc(100% - 50px)',
          overflow: 'auto',
          background: '#1e1e1e',
          borderRadius: 4,
          padding: 12,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          fontSize: 12,
          lineHeight: 1.6
        }}
      >
        {loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="加载日志中..." />
          </div>
        ) : logs.length === 0 ? (
          <Empty description="暂无日志" style={{ padding: 40 }} />
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                color: log.level === 'ERROR' ? '#ff6b6b' : 
                       log.level === 'WARNING' ? '#ffa94d' : 
                       '#d1d1d1',
                marginBottom: 4,
                wordBreak: 'break-all'
              }}
            >
              <span style={{ color: '#666', marginRight: 8 }}>
                [{log.timestamp.split(' ')[1]?.split(',')[0]}]
              </span>
              <Tag color={getLevelColor(log.level)} style={{ marginRight: 8 }}>
                {log.level}
              </Tag>
              <span style={{ color: '#9d9d9d', marginRight: 8 }}>
                {log.module}
              </span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </Drawer>
  )
}

export default LogMonitorDrawer
