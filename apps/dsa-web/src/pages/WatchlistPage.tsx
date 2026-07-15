import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownUp, ChevronDown, ChevronRight, Clock, Hash, Type } from 'lucide-react';
import { AppPage, EmptyState, Loading } from '../components/common';
import { useUiLanguage } from '../contexts/UiLanguageContext';
import { historyApi } from '../api/history';
import { getSentimentColor } from '../types/analysis';
import { buildDecisionActionLabelMap, getDecisionActionLabel } from '../utils/decisionAction';
import { formatDateTime } from '../utils/format';
import { getMarketPhaseSummaryLabel } from '../utils/marketPhase';
import { truncateStockName } from '../utils/stockName';
import { cn } from '../utils/cn';
import type { StockBarItem } from '../types/analysis';

type SortField = 'time' | 'code' | 'name';
type SortOrder = 'asc' | 'desc';

interface BoardGroup {
  boardName: string;
  items: StockBarItem[];
}

const UNCATEGORIZED_KEY = '__uncategorized__';

const getStockBoardName = (item: StockBarItem, isZh: boolean): string => {
  if (item.belongBoards && item.belongBoards.length > 0) {
    return item.belongBoards[0].name;
  }
  return isZh ? '未分类' : 'Uncategorized';
};

const WatchlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useUiLanguage();
  const [items, setItems] = useState<StockBarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [collapsedBoards, setCollapsedBoards] = useState<Set<string>>(new Set());

  const isZh = t('common.confirm') === '确定';
  const uncategorizedLabel = isZh ? '未分类' : 'Uncategorized';

  const loadWatchlist = useCallback(async () => {
    try {
      const response = await historyApi.getStockBarList({
        startDate: '2020-01-01',
        endDate: new Date().toISOString().slice(0, 10),
        limit: 500,
      });
      setItems(response.items);
    } catch {
      // keep existing items on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  // Group items by board name, then sort board names alphabetically
  const boardGroups = useMemo<BoardGroup[]>(() => {
    // First sort all items
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'time') {
        const aTime = a.lastAnalysisTime ? new Date(a.lastAnalysisTime).getTime() : 0;
        const bTime = b.lastAnalysisTime ? new Date(b.lastAnalysisTime).getTime() : 0;
        cmp = aTime - bTime;
      } else if (sortField === 'code') {
        cmp = (a.stockCode || '').localeCompare(b.stockCode || '');
      } else if (sortField === 'name') {
        cmp = (a.stockName || '').localeCompare(b.stockName || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    // Group by board name
    const groupMap = new Map<string, StockBarItem[]>();
    for (const item of sorted) {
      const boardName = getStockBoardName(item, isZh);
      const key = boardName === uncategorizedLabel ? UNCATEGORIZED_KEY : boardName;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    }

    // Sort board names alphabetically, push uncategorized to the end
    const groups = Array.from(groupMap.entries())
      .map(([key, groupItems]) => ({
        boardName: key === UNCATEGORIZED_KEY ? uncategorizedLabel : key,
        items: groupItems,
      }))
      .sort((a, b) => {
        if (a.boardName === uncategorizedLabel) return 1;
        if (b.boardName === uncategorizedLabel) return -1;
        return a.boardName.localeCompare(b.boardName, isZh ? 'zh-CN' : 'en');
      });

    return groups;
  }, [items, sortField, sortOrder, isZh, uncategorizedLabel]);

  const handleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortOrder(field === 'time' ? 'desc' : 'asc');
      return field;
    });
  }, []);

  const toggleBoard = useCallback((boardName: string) => {
    setCollapsedBoards((prev) => {
      const next = new Set(prev);
      if (next.has(boardName)) {
        next.delete(boardName);
      } else {
        next.add(boardName);
      }
      return next;
    });
  }, []);

  const sortButtons: { field: SortField; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { field: 'time', label: isZh ? '时间' : 'Time', icon: Clock },
    { field: 'code', label: isZh ? '代码' : 'Code', icon: Hash },
    { field: 'name', label: isZh ? '名称' : 'Name', icon: Type },
  ];

  const actionLabels = buildDecisionActionLabelMap(t);

  const handleItemClick = useCallback(
    (item: StockBarItem) => {
      navigate('/', {
        state: {
          stockCode: item.stockCode,
          stockName: item.stockName,
          autoAnalyze: false,
          selectionSource: 'watchlist',
        } as {
          stockCode?: string;
          stockName?: string;
          autoAnalyze?: boolean;
          selectionSource?: string;
        },
      });
    },
    [navigate],
  );

  return (
    <AppPage>
      {/* Sort toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{t('layout.route.watchlist.title')}</h1>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp className="mr-1 h-4 w-4 text-muted-text" aria-hidden="true" />
          {sortButtons.map(({ field, label, icon: Icon }) => (
            <button
              key={field}
              type="button"
              onClick={() => handleSort(field)}
              className={cn(
                'flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs transition-colors',
                sortField === field
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-subtle bg-surface/60 text-secondary-text hover:border-subtle-hover hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
              {sortField === field ? (
                <span className="ml-0.5 text-[10px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : boardGroups.length === 0 ? (
        <EmptyState
          title={isZh ? '暂无自选股票' : 'No watchlist items'}
          description={isZh ? '在首页输入股票代码进行分析后，股票将自动出现在这里' : 'Analyze stocks on the home page and they will appear here'}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {boardGroups.map((group) => {
            const isCollapsed = collapsedBoards.has(group.boardName);
            return (
              <div key={group.boardName} className="rounded-xl border border-subtle bg-surface/30 overflow-hidden">
                {/* Board header */}
                <button
                  type="button"
                  onClick={() => toggleBoard(group.boardName)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-hover/50"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-text" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-text" />
                    )}
                    <span className="text-sm font-medium text-foreground">{group.boardName}</span>
                    <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] text-muted-text">
                      {group.items.length}
                    </span>
                  </div>
                </button>

                {/* Stock cards within this board */}
                {!isCollapsed ? (
                  <div className="grid grid-cols-1 gap-3 border-t border-subtle/50 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.items.map((item) => {
                      const sentimentScore = typeof item.sentimentScore === 'number' ? item.sentimentScore : null;
                      const sentimentColor = sentimentScore !== null ? getSentimentColor(sentimentScore) : null;
                      const stockName = item.stockName || item.stockCode;
                      const operationLabel = getDecisionActionLabel(
                        item.action,
                        item.actionLabel,
                        item.operationAdvice,
                        t('history.sentiment'),
                        actionLabels,
                      );
                      const phaseLabel = getMarketPhaseSummaryLabel(item.marketPhaseSummary, language)
                        ?.replace('市场阶段: ', '')
                        .replace('市场阶段：', '')
                        .replace('Market phase: ', '');

                      return (
                        <button
                          key={item.stockCode}
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className="flex flex-col gap-2 rounded-xl border border-subtle bg-surface/60 p-3 text-left transition-all hover:border-primary/30 hover:bg-hover"
                        >
                          {/* Row 1: name + code + sentiment */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-medium text-foreground">
                                  {truncateStockName(stockName)}
                                </span>
                                {sentimentScore !== null && sentimentColor ? (
                                  <span
                                    className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                    style={{ color: sentimentColor, backgroundColor: `${sentimentColor}20` }}
                                  >
                                    {sentimentScore.toFixed(1)}
                                  </span>
                                ) : null}
                              </div>
                              <span className="mt-0.5 block text-xs text-muted-text">{item.stockCode}</span>
                            </div>
                            {phaseLabel ? (
                              <span className="flex-shrink-0 rounded-md bg-elevated px-1.5 py-0.5 text-[10px] text-secondary-text">
                                {phaseLabel}
                              </span>
                            ) : null}
                          </div>

                          {/* Row 2: operation advice */}
                          {operationLabel ? (
                            <p className="line-clamp-1 text-xs text-secondary-text">
                              <span className="text-muted-text">{isZh ? '建议' : 'Action'}: </span>
                              {operationLabel}
                            </p>
                          ) : null}

                          {/* Row 3: all boards for this stock */}
                          {item.belongBoards && item.belongBoards.length > 1 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.belongBoards.slice(0, 3).map((board, idx) => (
                                <span
                                  key={`${board.name}-${idx}`}
                                  className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-muted-text"
                                >
                                  {board.name}
                                </span>
                              ))}
                              {item.belongBoards.length > 3 ? (
                                <span className="text-[10px] text-muted-text">
                                  +{item.belongBoards.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Row 4: footer stats */}
                          <div className="flex items-center justify-between border-t border-subtle/30 pt-1.5 text-[11px] text-muted-text">
                            <span>
                              {isZh ? '分析' : 'Analyzed'} {item.analysisCount}{isZh ? '次' : 'x'}
                            </span>
                            {item.modelUsed ? (
                              <span className="max-w-[120px] truncate">{item.modelUsed}</span>
                            ) : null}
                            {item.lastAnalysisTime ? (
                              <span>{formatDateTime(item.lastAnalysisTime)}</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppPage>
  );
};

export default WatchlistPage;
