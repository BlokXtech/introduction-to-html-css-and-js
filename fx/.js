
  () => 
    // Data structures
    const state = {
      account: {
        balance: 100000,
        equity: 100000,
        marginUsed: 0,
        marginAvailable: 100000,
        dayTradingBuyingPower: 100000,
        maintenanceMargin: 0,
        unrealizedPnLPercent: 0,
      },
      positions: [],
      orders: [],
      watchlist: [
        {symbol: "EUR/USD", lastPrice: 1.1000, previousClose: 1.0975, change: 0, changePercent: 0, volume: 12000, volatility: 0.0005},
        {symbol: "USD/JPY", lastPrice: 135.00, previousClose: 134.80, change: 0, changePercent: 0, volume: 8800, volatility: 0.01},
        {symbol: "GBP/USD", lastPrice: 1.3000, previousClose: 1.3050, change: 0, changePercent: 0, volume: 5400, volatility: 0.0006},
      ],
      marketData: {}, // keyed by symbol for simplicity in simulation
      trades: [],
      alerts: [],
      strategies: [],
      chartCandles: [],  // candlestick data for current symbol/timeframe
      chartSymbol: "EUR/USD",
      chartTimeframe: 1, // minutes
      chartIntervalId: null,
    };

    // Utility Functions
    const formatNumber = (num, decimals=5) => {
      return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // Price Movement Simulation for watchlist prices
    function simulatePriceMovement(current, volatility) {
      const rnd = (Math.random() - 0.5) * 2 * volatility;
      let newPrice = current * (1 + rnd);
      return +(newPrice).toFixed(5);
    }

    // Calculate change and percentage between new and previous
    function calculateChange(last, prev) {
      const change = last - prev;
      const changePct = (change / prev) * 100;
      return { change, changePct };
    }

    // Initialize marketData from watchlist
    function initMarketData() {
      state.watchlist.forEach(w => {
        state.marketData[w.symbol] = {
          symbol: w.symbol,
          open: w.lastPrice,
          high: w.lastPrice,
          low: w.lastPrice,
          close: w.lastPrice,
          volume: w.volume,
          timestamp: new Date(),
          bid: w.lastPrice - 0.0001,
          ask: w.lastPrice + 0.0001,
          spread: 0.0002,
          volatility: w.volatility,
          previousClose: w.previousClose,
          lastPrice: w.lastPrice,
        };
      });
    }

    // Update watchlist data and UI
    function updateWatchlistTable() {
      const tbody = document.getElementById('watchlist-tbody');
      tbody.innerHTML = "";

      state.watchlist.forEach(item => {
        const tr = document.createElement('tr');
        tr.setAttribute('tabindex', '0');
        tr.setAttribute('role', 'row');
        tr.dataset.symbol = item.symbol;
        // Clicking row selects chart symbol
        tr.onclick = () => selectChartSymbol(item.symbol);

        const tdSymbol = document.createElement('td');
        tdSymbol.textContent = item.symbol;

        const tdPrice = document.createElement('td');
        tdPrice.textContent = formatNumber(item.lastPrice, item.symbol.includes("JPY") ? 3 : 5);

        let priceChange = item.lastPrice - item.previousClose;
        const tdChange = document.createElement('td');
        tdChange.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(item.symbol.includes("JPY") ? 3 : 5);
        tdChange.className = priceChange >= 0 ? "price-up" : "price-down";

        const changePercent = (priceChange / item.previousClose) * 100;
        const tdChangePercent = document.createElement('td');
        tdChangePercent.textContent = (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%';
        tdChangePercent.className = priceChange >= 0 ? "price-up" : "price-down";

        const tdVolume = document.createElement('td');
        tdVolume.textContent = item.volume.toLocaleString();

        tr.appendChild(tdSymbol);
        tr.appendChild(tdPrice);
        tr.appendChild(tdChange);
        tr.appendChild(tdVolume);
        tbody.appendChild(tr);
      });
    }

    // Select chart symbol from watchlist click
    function selectChartSymbol(symbol) {
      if (symbol !== state.chartSymbol) {
        state.chartSymbol = symbol;
        document.getElementById('current-symbol').textContent = symbol;
        loadChartData(symbol, state.chartTimeframe);
      }
    }

    // Chart rendering
    const canvas = document.getElementById('candlestick-chart');
    const ctx = canvas.getContext('2d');
    let chartWidth = canvas.width;
    let chartHeight = canvas.height;

    function clearChart() {
      ctx.clearRect(0, 0, chartWidth, chartHeight);
    }

    // Draw candlestick chart with simple moving average overlay
    function drawChart() {
      clearChart();
      if (!state.chartCandles.length) return;

      const candles = state.chartCandles;
      // Draw background
      ctx.fillStyle = 'var(--panel-bg)';
      ctx.fillRect(0, 0, chartWidth, chartHeight);

      // Compute ranges
      const highPrice = Math.max(...candles.map(c => c.high));
      const lowPrice = Math.min(...candles.map(c => c.low));
      const priceRange = highPrice - lowPrice;

      // Set chart margins
      const margin = 40;
      const chartH = chartHeight - margin * 2;
      const chartW = chartWidth - margin * 2;
      const candleWidth = chartW / candles.length;

      // Background horizontal grid lines
      ctx.strokeStyle = '#374151'; // border color
      ctx.lineWidth = 1;
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#9ca3af'; // text-secondary

      for (let i = 0; i <= 5; i++) {
        const y = margin + (chartH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(chartWidth - margin, y);
        ctx.stroke();

        // Price label
        const priceLabel = (highPrice - (priceRange / 5) * i).toFixed(5);
        ctx.fillText(priceLabel, 4, y + 4);
      }

      // Draw candles
      candles.forEach((candle, i) => {
        const x = margin + i * candleWidth;

        // Calculate y positions
        const yOpen = margin + chartH * (1 - (candle.open - lowPrice) / priceRange);
        const yClose = margin + chartH * (1 - (candle.close - lowPrice) / priceRange);
        const yHigh = margin + chartH * (1 - (candle.high - lowPrice) / priceRange);
        const yLow = margin + chartH * (1 - (candle.low - lowPrice) / priceRange);

        // Determine candle color
        const isUp = candle.close >= candle.open;
        ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 1;

        // Draw wick
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, yHigh);
        ctx.lineTo(x + candleWidth / 2, yLow);
        ctx.stroke();

        // Draw body
        const bodyHeight = Math.abs(yClose - yOpen);
        const bodyY = Math.min(yOpen, yClose);
        ctx.fillRect(x + candleWidth * 0.15, bodyY, candleWidth * 0.7, Math.max(bodyHeight, 1));

      });

      // Draw Simple Moving Average (MA 10)
      if (candles.length >= 10) {
        ctx.beginPath();
        ctx.strokeStyle = '#22c55eaa';
        ctx.lineWidth = 2;
        let movingAvgPoints = candles.map((_c, i, arr) => {
          if (i < 9) return null;
          const sum = arr.slice(i-9, i+1).reduce((a,v) => a + v.close, 0);
          return sum / 10;
        });
        for (let i = 9; i < candles.length; i++) {
          const x = margin + (i + 0.5) * candleWidth;
          const price = movingAvgPoints[i];
          const y = margin + chartH * (1 - (price - lowPrice) / priceRange);
          if (i === 9) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Generate dummy candle data for symbol and timeframe
    function generateCandles(symbol, timeframeMinutes, count = 60) {
      const base = state.marketData[symbol]?.lastPrice || 1.0;
      let candles = [];
      let lastClose = base;
      for (let i=count-1; i>=0; i--) {
        // Simulate candle prices
        let open = lastClose;
        let volatility = 0.0004;
        let close = open * (1 + (Math.random() - 0.5) * volatility);
        close = +close.toFixed(5);
        let high = Math.max(open, close) * (1 + Math.random() * volatility);
        let low = Math.min(open, close) * (1 - Math.random() * volatility);

        // Round prices based on symbol (handle JPY separately)
        if(symbol.includes("JPY")){
          high = +high.toFixed(3);
          low = +low.toFixed(3);
          open = +open.toFixed(3);
          close = +close.toFixed(3);
        }

        candles.unshift({
          open,
          close,
          high,
          low,
          volume: Math.floor(100 + Math.random() * 1000),
          timestamp: Date.now() - i * timeframeMinutes * 60000
        });
        lastClose = close;
      }
      return candles;
    }

    // Load chart data for selected symbol and timeframe
    function loadChartData(symbol, timeframe) {
      clearTimeout(state.chartIntervalId);

      // Generate new data set
      state.chartCandles = generateCandles(symbol, timeframe, 60);

      // Draw chart immediately
      drawChart();

      // Set interval to update chart with new candle every timeframe
      if(timeframe < 1440) {
        state.chartIntervalId = setInterval(() => {
          addNewChartCandle(symbol, timeframe);
        }, timeframe * 60000);
      }
    }

    // Add new candle based on last candle and simulate price movement
    function addNewChartCandle(symbol, timeframe) {
      const candles = state.chartCandles;
      if(candles.length === 0) return;

      const lastCandle = candles[candles.length -1];
      const volatility = state.marketData[symbol].volatility;

      // Create new candle approx
      let open = lastCandle.close;
      let close = open * (1 + (Math.random() - 0.5) * volatility);
      close = +close.toFixed(5);
      let high = Math.max(open, close) * (1 + Math.random() * volatility);
      let low = Math.min(open, close) * (1 - Math.random() * volatility);

      // For JPY pairs round to 3 decimals
      if(symbol.includes("JPY")){
        high = +high.toFixed(3);
        low = +low.toFixed(3);
        open = +open.toFixed(3);
        close = +close.toFixed(3);
      }

      let newCandle = {
        open,
        close,
        high,
        low,
        volume: Math.floor(100 + Math.random() * 1000),
        timestamp: Date.now()
      };

      // Add new candle, and remove oldest
      candles.push(newCandle);
      if (candles.length > 60) candles.shift();

      drawChart();
    }

    // Handle timeframe buttons clicking
    function setupTimeframeSelection() {
      const buttons = document.querySelectorAll('#timeframes button');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-pressed', 'true');
          state.chartTimeframe = parseInt(btn.dataset.timeframe);
          loadChartData(state.chartSymbol, state.chartTimeframe);
        });
      });
    }

    // Update simulated real-time prices in watchlist and marketData
    function updateRealTimePrices() {
      state.watchlist = state.watchlist.map(stock => {
        let newPrice = simulatePriceMovement(stock.lastPrice, stock.volatility);
        const {change, changePct