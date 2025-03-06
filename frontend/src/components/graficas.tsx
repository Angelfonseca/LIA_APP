import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";

interface DataPoint {
  date: string;
  values: {
    name: string;
    value: number;
    sensor: string;
    date: string;
    rack?: string | number;
    granjaCamara?: string | number;
    originalDate?: string;
  }[];
  processedValues?: {
    key: string;
    sensor: string;
    variable: string;
    min: number;
    max: number;
    avg: number;
  }[];
}

interface AggregatedData {
  date: string;
  name: string;
  sensor: string;
  value: number;
  avg: number;
  min: number;
  max: number;
  minDate: string;
  maxDate: string;
  rack?: string | number;
  granjaCamara?: string | number;
}

interface ChartProps {
  title: string;
  datos: DataPoint[];
  chartType: "bar" | "line" | "scatter";
  selectedFields: string[];
  groupBy: string;
}

// Modern color palette for charts
const CHART_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#0099cc',
  '#ff9966', '#99cc99', '#cc99ff', '#ff6666', '#99ccff'
];

const formatDateSafely = (dateInput: string | Date | null | undefined): string => {
  try {
    // Handle null/undefined
    if (!dateInput) return "Invalid Date";
    
    // Convert string to Date if needed
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Check if date is valid before calling toISOString
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch (error) {
    console.error("Error formatting date:", dateInput, error);
    return "Invalid Date";
  }
};

// Helper to check if a date is valid
const isValidDate = (dateInput: any): boolean => {
  try {
    if (!dateInput) return false;
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return !isNaN(date.getTime());
  } catch (e) {
    return false;
  }
};

const Chart: React.FC<ChartProps> = ({ title, datos, chartType, groupBy }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
  
  useEffect(() => {
    // Function to handle resize
    const handleResize = () => {
      chartInstance?.resize();
    };

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chartInstance]);

  const groupDataBy = (data: DataPoint[], groupBy: string): DataPoint[] => {
    const groupedData: { [key: string]: DataPoint } = {};

    // For raw data, return as is with no grouping
    if (groupBy === "raw") {
      return data;
    }

    // Special handling for rack and granjaCamara
    if (groupBy === "rack") {
      // Group by rack
      data.forEach((entry) => {
        entry.values.forEach(value => {
          if (value.rack !== undefined) {
            const rackKey = `Rack ${value.rack}`;
            if (!groupedData[rackKey]) {
              groupedData[rackKey] = { date: rackKey, values: [] };
            }
            groupedData[rackKey].values.push({...value});
          }
        });
      });
      return Object.values(groupedData);
    } 
    
    if (groupBy === "granjaCamara") {
      // Group by granjaCamara
      data.forEach((entry) => {
        entry.values.forEach(value => {
          if (value.granjaCamara !== undefined) {
            const camaraKey = `Cámara ${value.granjaCamara}`;
            if (!groupedData[camaraKey]) {
              groupedData[camaraKey] = { date: camaraKey, values: [] };
            }
            groupedData[camaraKey].values.push({...value});
          }
        });
      });
      return Object.values(groupedData);
    }

    // For other grouping types
    data.forEach((entry) => {
      try {
        // Validate the date before proceeding
        if (!entry.date || !isValidDate(entry.date)) {
          console.warn("Invalid date in entry:", entry);
          return; // Skip this entry
        }
        
        const date = new Date(entry.date);
        let groupKey = "";
        let dateRange = "";
        
        switch (groupBy) {
          case "day":
            groupKey = formatDateSafely(date);
            dateRange = groupKey;
            break;
          
          case "1month":
            try {
              const month = date.getMonth() + 1;
              const year = date.getFullYear();
              groupKey = `${year}-${month}`;
              
              // Safely create month start/end dates
              const monthStart = new Date(year, date.getMonth(), 1);
              const monthEnd = new Date(year, date.getMonth() + 1, 0);
              
              if (!isValidDate(monthStart) || !isValidDate(monthEnd)) {
                throw new Error("Invalid month dates");
              }
              
              dateRange = `${formatDateSafely(monthStart)} to ${formatDateSafely(monthEnd)}`;
            } catch (e) {
              console.error("Error in 1month grouping:", e);
              groupKey = formatDateSafely(date);
              dateRange = groupKey;
            }
            break;
    
          case "3days":
          case "5days":
          case "7days":
          case "15days":
            try {
              // Extract the day period (3, 5, 7, or 15)
              const dayPeriod = parseInt(groupBy.replace("days", ""));
              if (isNaN(dayPeriod)) throw new Error("Invalid day period");
              
              const dayOfMonth = date.getDate();
              const startDay = Math.floor((dayOfMonth - 1) / dayPeriod) * dayPeriod + 1;
              
              const year = date.getFullYear();
              const month = date.getMonth();
              
              // Create a new date for start of period
              const startDate = new Date(year, month, startDay);
              if (!isValidDate(startDate)) throw new Error("Invalid start date");
              
              // Determine last day of month for validation
              const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
              
              // Calculate end day without exceeding month end
              const endDay = Math.min(startDay + (dayPeriod - 1), lastDayOfMonth);
              const endDate = new Date(year, month, endDay);
              if (!isValidDate(endDate)) throw new Error("Invalid end date");
              
              const startFormatted = formatDateSafely(startDate);
              const endFormatted = formatDateSafely(endDate);
              
              groupKey = `${startFormatted} to ${endFormatted}`;
              dateRange = groupKey;
            } catch (e) {
              console.error(`Error in ${groupBy} grouping:`, e);
              groupKey = formatDateSafely(date) || entry.date; // Fallback
              dateRange = groupKey;
            }
            break;
    
          // ...existing code for rack and granjaCamara...
    
          default:
            groupKey = formatDateSafely(date) || entry.date;
            dateRange = groupKey;
        }
    
        // Only add to groupedData if we have a valid group key
        if (groupKey && groupKey !== "Invalid Date") {
          if (!groupedData[groupKey]) {
            groupedData[groupKey] = { date: dateRange, values: [] };
          }
          
          groupedData[groupKey].values.push(...entry.values);
        }
      } catch (error) {
        console.error("Error processing entry for grouping:", error, entry);
        // Skip this entry on error
      }
    });
    
    return Object.values(groupedData);
  };

  const processGroupedData = (data: DataPoint[]): AggregatedData[] => {
    const grouped: {
      [key: string]: { date: string; value: number; sensor: string; valueDate: string; rack?: string | number; granjaCamara?: string | number }[];
    } = {};
    
    // Special handling for raw data display or rack/granjaCamara grouping
    if (groupBy === "raw" || groupBy === "rack" || groupBy === "granjaCamara") {
      if (data.length > 0) {
        // For raw/rack/granjaCamara data, create individual data points without aggregation
        const individualDataPoints: AggregatedData[] = [];
        
        data.forEach((entry) => {
          entry.values.forEach((value) => {
            // Format the date for display
            const valueDate = value.date;
            const formattedDate = new Date(valueDate).toISOString();
            
            individualDataPoints.push({
              date: value.date || entry.date, // Use value date or entry date if available
              name: value.name,
              sensor: value.sensor,
              value: value.value,
              avg: value.value, // Same as value for raw data
              min: value.value, // Same as value for raw data
              max: value.value, // Same as value for raw data
              minDate: formattedDate,
              maxDate: formattedDate,
              rack: value.rack,
              granjaCamara: value.granjaCamara
            });
          });
        });
        
        if (individualDataPoints.length > 0) {
          return individualDataPoints;
        }
      }
    }
    
    data.forEach((entry) => {
      entry.values.forEach((value) => {
        // Include rack and granjaCamara in the group key if available
        const rackInfo = value.rack !== undefined ? `-R${value.rack}` : '';
        const camaraInfo = value.granjaCamara !== undefined ? `-C${value.granjaCamara}` : '';
        // Store the full entry date, not just parts of it
        const groupKey = `${value.name}-${value.sensor}${rackInfo}${camaraInfo}-${entry.date}`;
        
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push({
          date: entry.date, // Use the full entry date
          valueDate: value.date,
          value: value.value,
          sensor: value.sensor,
          rack: value.rack,
          granjaCamara: value.granjaCamara
        });
      });
    });
    
    const formatDate = (dateString: string): string => {
      const date = new Date(dateString);
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses comienzan desde 0
      const year = date.getFullYear();
      
      return `${day}/${month}/${year} a las ${hour}:${minute}`;
    };

    const aggregated: AggregatedData[] = [];
    Object.entries(grouped).forEach(([groupKey, entries]) => {
      const values = entries.map((e) => e.value);
      const valuesDate = entries.map((e) => e.valueDate);
      const value = values.reduce((a: number, b: number) => a + b, 0);
  
      // Parse the group key - now includes potential rack and camera info
      const keyParts = groupKey.split("-");
      const name = keyParts[0];
      const sensor = keyParts[1].split("R")[0].split("C")[0]; // Remove rack/camera suffix if present
      // Keep the full date from the entry, not just from the key
      const date = entries[0].date;
      
      // Get rack and granjaCamara from the first entry (all should be the same in this group)
      const { rack, granjaCamara } = entries[0];
  
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const minDate = formatDate(valuesDate[values.indexOf(min)]);
      const maxDate = formatDate(valuesDate[values.indexOf(max)]);
  
      aggregated.push({
        date,
        name,
        sensor,
        value,
        avg,
        min,
        max,
        minDate,
        maxDate,
        rack,
        granjaCamara
      });
    });
  
    return aggregated;
  };

  const getUniqueDates = (groupedData: DataPoint[], groupBy: string): string[] => {
    if (groupBy === "nothing") {
      return groupedData.map((d) => d.date); // No hay agrupación
    }
  
    // Para otros casos, asegurar que las fechas estén formateadas correctamente según la agrupación
    const uniqueDatesSet = new Set<string>();
  
    groupedData.forEach((entry) => {
      const groupKey = entry.date;
      uniqueDatesSet.add(groupKey);
    });
  
    return Array.from(uniqueDatesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  };

  useEffect(() => {
    // Dispose of previous chart instance if it exists
    if (chartInstance) {
      chartInstance.dispose();
    }

    // Create chart if the ref is available and data exists
    if (chartRef.current && datos && datos.length > 0) {
      // Initialize chart
      const chart = echarts.init(chartRef.current);
      setChartInstance(chart);
      
      // Group the data based on the groupBy parameter
      try {
        const groupedData = groupDataBy(datos, groupBy);
        
        // Process the data specifically based on grouping type
        const aggregatedData = processGroupedData(groupedData);
        
        console.log("groupedData by ", groupBy, ":", groupedData);
        console.log("aggregatedData:", aggregatedData);
        
        // Get unique dates for x-axis - handle raw data specially
        let uniqueDates: string[];
        
        if (groupBy === "raw") {
          // For raw data, use the original dates but format them for readability
          const dateSet = new Set<string>();
          aggregatedData.forEach(item => {
            try {
              // Try to parse the date and get a consistent format
              const date = new Date(item.date);
              if (!isNaN(date.getTime())) {
                dateSet.add(item.date); // Store the original date string
              }
            } catch (e) {
              console.warn("Invalid date:", item.date);
            }
          });
          uniqueDates = Array.from(dateSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        } else {
          uniqueDates = getUniqueDates(groupedData, groupBy);
        }
        
        console.log("uniqueDates:", uniqueDates);
        
        // Create a simpler series array with direct value mapping
        const series = [];
        
        // Find all unique series names first
        const seriesMap = new Map();
        aggregatedData.forEach(data => {
          const rackInfo = data.rack !== undefined ? ` (Rack ${data.rack})` : '';
          const camaraInfo = data.granjaCamara !== undefined ? ` (Cámara ${data.granjaCamara})` : '';
          const seriesName = `${data.name} - ${data.sensor}${rackInfo}${camaraInfo}`;
          
          if (!seriesMap.has(seriesName)) {
            seriesMap.set(seriesName, {
              name: seriesName,
              type: chartType,
              data: new Array(uniqueDates.length).fill(null),
              lineStyle: { type: "solid" },
            });
          }
        });
        
        // Now map the data points to the right series and position
        aggregatedData.forEach(data => {
          const rackInfo = data.rack !== undefined ? ` (Rack ${data.rack})` : '';
          const camaraInfo = data.granjaCamara !== undefined ? ` (Cámara ${data.granjaCamara})` : '';
          const seriesName = `${data.name} - ${data.sensor}${rackInfo}${camaraInfo}`;
          
          // Use exact date matching for raw data rather than converting to localeString
          const dateIndex = uniqueDates.indexOf(data.date);
          
          console.log(`Mapping ${seriesName} data for date ${data.date}, index: ${dateIndex}, value: ${data.value}`);
          
          if (dateIndex !== -1) {
            const seriesObject = seriesMap.get(seriesName);
            seriesObject.data[dateIndex] = data.value;
          }
        });
        
        // Apply styling to series
        const finalSeries = Array.from(seriesMap.values()).map((series, index) => {
          return {
            ...series,
            data: series.data.filter((val: number | null) => val !== null),
            // Apply color from our palette
            color: CHART_COLORS[index % CHART_COLORS.length],
            // Add animations and styling based on chart type
            animationDuration: 1000,
            animationEasing: 'elasticOut',
            smooth: chartType === 'line' ? 0.3 : undefined,
            symbolSize: chartType === 'scatter' ? 10 : 5,
            lineStyle: chartType === 'line' ? {
              width: 3,
              type: 'solid',
              shadowColor: 'rgba(0,0,0,0.2)',
              shadowBlur: 10
            } : undefined,
            itemStyle: {
              borderRadius: chartType === 'bar' ? 6 : 0,
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.2)'
            }
          };
        });
        
        console.log("Final series with data:", finalSeries);

        // Enhanced chart options
        const options = {
          title: {
            text: title,
            left: 'center',
            textStyle: {
              fontSize: 18,
              fontWeight: 'bold',
              color: '#333'
            }
          },
          tooltip: {
            trigger: "axis",
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#ddd',
            borderWidth: 1,
            textStyle: {
              color: '#333'
            },
            axisPointer: {
              type: 'shadow',
              shadowStyle: {
                color: 'rgba(150,150,150,0.1)'
              }
            },
            formatter: (params: { seriesName: string; value: number; axisValue: string }[]) => {
              return params
                .map((p) => {
                  // Extract name and sensor from series name, which now may include rack and camera info
                  const seriesNameParts = p.seriesName.split(" - ");
                  const name = seriesNameParts[0];
                  
                  // For raw data, show simpler tooltip without statistics
                  if (groupBy === "raw") {
                    const locationInfo = [];
                    // Try to extract rack and camera info from series name
                    if (p.seriesName.includes("(Rack")) {
                      const rackMatch = p.seriesName.match(/\(Rack ([^)]+)\)/);
                      if (rackMatch) locationInfo.push(`Rack: ${rackMatch[1]}`);
                    }
                    if (p.seriesName.includes("(Cámara")) {
                      const camaraMatch = p.seriesName.match(/\(Cámara ([^)]+)\)/);
                      if (camaraMatch) locationInfo.push(`Cámara: ${camaraMatch[1]}`);
                    }
                    
                    const locationText = locationInfo.length > 0 ? `<br /><strong>Ubicación:</strong> ${locationInfo.join(', ')}<br />` : '';
                    
                    return `<strong>${p.seriesName}:</strong> ${p.value}<br />
                      ${locationText}
                      <strong>Fecha:</strong> ${p.axisValue}`;
                  }
                  
                  // Find the data point that matches this series for grouped data
                  const dataPoint = aggregatedData.find((entry) => {
                    const rackInfo = entry.rack !== undefined ? ` (Rack ${entry.rack})` : '';
                    const camaraInfo = entry.granjaCamara !== undefined ? ` (Cámara ${entry.granjaCamara})` : '';
                    const fullName = `${entry.name} - ${entry.sensor}${rackInfo}${camaraInfo}`;
                    return fullName === p.seriesName;
                  });
            
                  if (dataPoint) {
                    // Include rack and granjaCamara in the tooltip if available
                    const locationInfo = [];
                    if (dataPoint.rack !== undefined) locationInfo.push(`Rack: ${dataPoint.rack}`);
                    if (dataPoint.granjaCamara !== undefined) locationInfo.push(`Cámara: ${dataPoint.granjaCamara}`);
                    const locationText = locationInfo.length > 0 ? `<br /><strong>Ubicación:</strong> ${locationInfo.join(', ')}<br />` : '';
                    
                    // Formateamos las estadísticas
                    const stats = `
                      ${locationText}
                      <strong>Avg:</strong> ${dataPoint.avg.toFixed(2)}<br />
                      <strong>Min:</strong> ${dataPoint.min} (on ${dataPoint.minDate})<br />
                      <strong>Max:</strong> ${dataPoint.max} (on ${dataPoint.maxDate})<br />
                    `;
                    
                    // Mostrar los datos y estadísticas
                    return `${p.seriesName}: ${p.value}<br />${stats}`;
                  }
            
                  return null;
                })
                .filter((item) => item)
                .join("<br />");
            },
            position: (
              point: number[],
              _: unknown,
              __: unknown,
              ___: unknown,
              size: { viewSize: number[]; contentSize: number[] }
            ) => {
              const [x, y] = point;
              const { viewSize, contentSize } = size;
              const xPos =
                x + contentSize[0] > viewSize[0] ? x - contentSize[0] : x;
              const yPos =
                y + contentSize[1] > viewSize[1] ? y - contentSize[1] : y;
              return [xPos, yPos];
            },
            extraCssText:
              "max-width: 350px; word-wrap: break-word; overflow: visible; box-shadow: 0 0 8px rgba(0,0,0,0.1); border-radius: 4px; padding: 10px;",
            showDelay: 0,
            hideDelay: 100,
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          legend: {
            data: Array.from(seriesMap.keys()),
            type: 'scroll',
            bottom: 0,
            padding: [5, 5, 5, 5],
            textStyle: {
              color: '#333'
            },
            icon: 'roundRect',
            pageIconColor: '#666',
            pageIconInactiveColor: '#aaa',
            pageTextStyle: {
              color: '#333'
            }
          },
          toolbox: {
            show: true,
            feature: {
              saveAsImage: { show: true, title: 'Guardar' },
              dataZoom: { show: true, title: { zoom: 'Zoom', back: 'Atrás' } },
              restore: { show: true, title: 'Restaurar' },
              dataView: { show: true, title: 'Datos', lang: ['Vista de datos', 'Cerrar', 'Actualizar'] }
            },
            iconStyle: {
              borderColor: '#666'
            }
          },
          xAxis: {
            type: "category",
            data: uniqueDates,
            axisLine: {
              lineStyle: {
                color: '#999'
              }
            },
            axisTick: {
              alignWithLabel: true
            },
            axisLabel: {
              formatter: (value: string) => {
                // For raw data, format the date to be more readable
                if (groupBy === "raw") {
                  try {
                    const date = new Date(value);
                    // Ensure it's a valid date before formatting
                    if (!isNaN(date.getTime())) {
                      // Format: HH:MM:SS
                      return date.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        second: '2-digit',
                        hour12: false
                      });
                    }
                  } catch (e) {
                    console.warn("Error formatting date:", value);
                  }
                }
                return value;
              },
              rotate: groupBy === "raw" ? 45 : 0, // Rotate labels for raw data to fit better
              interval: groupBy === "raw" ? 'auto' : 0,
              color: '#666',
              fontSize: 11
            }
          },
          yAxis: {
            type: "value",
            axisLine: {
              show: true,
              lineStyle: {
                color: '#999'
              }
            },
            splitLine: {
              lineStyle: {
                type: 'dashed',
                color: '#ddd'
              }
            }
          },
          dataZoom: [{
            type: 'inside',
            start: 0,
            end: 100
          }, {
            show: true,
            type: 'slider',
            start: 0,
            end: 100,
            height: 25,
            bottom: 30,
            borderColor: 'transparent',
            backgroundColor: '#f1f1f1',
            fillerColor: 'rgba(84, 112, 198, 0.2)',
            handleStyle: {
              color: '#5470c6',
              borderWidth: 1
            },
            moveHandleStyle: {
              color: '#5470c6'
            },
            emphasis: {
              handleStyle: {
                borderColor: '#5470c6'
              }
            }
          }],
          series: finalSeries,
          animation: true
        };
        
        chart.setOption(options);
        
        // Handle chart dispose on component unmount
        return () => {
          chart.dispose();
          setChartInstance(null);
        };
      } catch (error) {
        console.error("Error processing chart data:", error);
        // Render a basic error message in the chart to avoid crashing
        if (chartRef.current) {
          const chart = echarts.init(chartRef.current);
          chart.setOption({
            title: {
              text: "Error Loading Chart",
              subtext: "There was a problem processing the data",
              left: 'center'
            }
          });
        }
      }
    }
  }, [title, datos, chartType, groupBy]);

  return (
    <div className="chart-wrapper">
      <div ref={chartRef} className="chart-container" style={{ width: '100%', height: '450px' }} />
    </div>
  );
};

export default Chart;
