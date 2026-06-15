/**
 * CodeGuide.tsx
 * 
 * Knowledge Base > Code Guide - Comprehensive development documentation
 * with tabbed interface, search functionality, and modern UI
 * UI Location: Knowledge Base > Code Guide
 * Page ID: information_codeguide
 */
import React, { useState, useMemo } from 'react';
import { 
  Button, Typography, Divider, Tag, Space, Card, Tabs, Input, Table, 
  Descriptions, Alert, Collapse, Timeline, List, Badge, Row, Col,
  Statistic
} from 'antd';
import { 
  DownloadOutlined, SearchOutlined, CodeOutlined, ApiOutlined, 
  DatabaseOutlined, FileTextOutlined, SettingOutlined, RocketOutlined,
  BulbOutlined, FolderOutlined, CloudServerOutlined, SwapOutlined,
  SafetyOutlined, HistoryOutlined, CheckCircleOutlined, AppstoreOutlined,
  BuildOutlined, DeploymentUnitOutlined, ExperimentOutlined, LinkOutlined,
  ThunderboltOutlined, NodeIndexOutlined, FunctionOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text, Link } = Typography;
