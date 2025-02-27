import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface DataPoint {
  date: string;
  values: {
    name: string;
    value: number;
    sensor: string;
    date: string;
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
}

interface ChartProps {
  title: string;
  datos: DataPoint[];
  chartType: "bar" | "line" | "scatter";
  selectedFields: string[];
  groupBy: string;
}

const Chart: React.FC<ChartProps> = ({ title, datos, chartType, groupBy }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const groupDataBy = (data: DataPoint[], groupBy: string): DataPoint[] => {
    const groupedData: { [key: string]: DataPoint } = {};
  
    data.forEach((entry) => {
      const date = new Date(entry.date);
      let groupKey = "";
      let dateRange = "";
      switch (groupBy) {
        case "day":
          groupKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
          dateRange = groupKey;
          break;
        
        case "1month":
          groupKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          dateRange = `${new Date(date.getFullYear(), date.getMonth(), 1)
            .toISOString()
            .split("T")[0]} to ${new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
          )
            .toISOString()
            .split("T")[0]}`;
          break;
  
        case "3days":
          {
            const startDay = Math.floor((date.getDate() - 1) / 3) * 3 + 1;
            const startDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay
            );
            const endDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay + 2
            );
            groupKey = `${startDate.toISOString().split("T")[0]} to ${
              endDate.toISOString().split("T")[0]
            }`;
            dateRange = groupKey;
          }
          break;
  
        case "5days":
          {
            const startDay = Math.floor((date.getDate() - 1) / 5) * 5 + 1;
            const startDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay
            );
            const endDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay + 4
            );
            groupKey = `${startDate.toISOString().split("T")[0]} to ${
              endDate.toISOString().split("T")[0]
            }`;
            dateRange = groupKey;
          }
          break;
  
        case "7days":
          {
            const startDay = Math.floor((date.getDate() - 1) / 7) * 7 + 1;
            const startDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay
            );
            const endDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay + 6
            );
            groupKey = `${startDate.toISOString().split("T")[0]} to ${
              endDate.toISOString().split("T")[0]
            }`;
            dateRange = groupKey;
          }
          break;
  
        case "15days":
          {
            const startDay = Math.floor((date.getDate() - 1) / 15) * 15 + 1;
            const startDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay
            );
            const endDate = new Date(
              date.getFullYear(),
              date.getMonth(),
              startDay + 14
            );
            groupKey = `${startDate.toISOString().split("T")[0]} to ${
              endDate.toISOString().split("T")[0]
            }`;
            dateRange = groupKey;
          }
          break;
  
        default:
          groupKey = entry.date;
          dateRange = entry.date;
      }
  
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = { date: dateRange, values: [] };
      }
  
      groupedData[groupKey].values.push(...entry.values);
    });
    return Object.values(groupedData);
  };
  
  const processGroupedData = (data: DataPoint[]): AggregatedData[] => {
    const grouped: {
      [key: string]: { date: string; value: number; sensor: string; valueDate: string}[];
    } = {};
    data.forEach((entry) => {
      entry.values.forEach((value) => {
        const groupKey = `${value.name}-${value.sensor}-${entry.date}`;
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push({
          date: entry.date,
          valueDate: value.date,
          value: value.value,
          sensor: value.sensor,
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
  
      const [name, sensor, date] = groupKey.split("-");
  
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
    const chart = echarts.init(chartRef.current as HTMLDivElement);

    // Agrupar y agregar los datos
    const groupedData = groupDataBy(datos, groupBy);
    const aggregatedData = processGroupedData(groupedData);
    console.log("groupedDataaaa ",groupedData);
    console.log("aggregatedDataaaa ",aggregatedData);
    // Crear fechas únicas para el eje X
    const uniqueDates = getUniqueDates(groupedData, groupBy);
    // Preparamos las series para el gráfico
    const series = aggregatedData.reduce((acc: { name: string; type: string; data: number[]; lineStyle: { type: string } }[], data) => {
      const existingSeries = acc.find(
        (s: { name: string }) => s.name === `${data.name} - ${data.sensor}`
      );
    
      if (existingSeries) {
        existingSeries.data.push(data.value);
      } else {
        acc.push({
          name: `${data.name} - ${data.sensor}`,
          type: chartType,
          data: uniqueDates.map((date) => {
            const entry = aggregatedData.find(
              (d) => d.date === date && d.name === data.name && d.sensor === data.sensor
            );
            return entry ? entry.value : null; // Devolver null si no hay valor para esa fecha
          }).filter((value): value is number => value !== null),          
          lineStyle: {
            type: "solid",
          },
        });
      }
      return acc;
    }, []);
    const options = {
      title: {
        text: title,
      },
      tooltip: {
        trigger: "axis",
        formatter: (params: { seriesName: string; value: number }[]) => {
          return params
            .map((p) => {
              const [namePart, sensorPart] = (p.seriesName || "").split("-").map((part) => part.trim());
        
              // Buscar el grupo correspondiente para obtener las estadísticas
              const [name, sensor] = namePart && sensorPart ? [namePart, sensorPart] : ["", ""];
              const dataPoint = aggregatedData.find(
                (entry) => entry.name === name && entry.sensor === sensor
              );
        
              if (dataPoint) {
                // Formateamos las estadísticas
                const stats = `
                  <strong>Avg:</strong> ${dataPoint.avg.toFixed(2)}<br />
                  <strong>Min:</strong> ${dataPoint.min} (on ${dataPoint.minDate})<br />
                  <strong>Max:</strong> ${dataPoint.max} (on ${dataPoint.maxDate})<br />
                `;
                
                // Mostrar los datos y estadísticas
                return `${p.seriesName}: ${p.value}<br />${stats}`;
              }
        
              return null;  // En caso de que no se encuentren datos estadísticos
            })
            .filter((item) => item)  // Filtrar valores nulos
            .join("<br />");  // Unir las líneas con saltos de línea
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
          "max-width: 350px; word-wrap: break-word; overflow: visible;",
        showDelay: 0,
        hideDelay: 100,
      },
      legend: {
        data: aggregatedData.map((d) => `${d.name} - ${d.sensor}`),
      },
      xAxis: {
        type: "category",
        data: uniqueDates,
      },
      yAxis: {
        type: "value",
      },
      series,
    };
    
    chart.setOption(options);
    
    return () => {
      chart.dispose();
    };
    
  }, [title, datos, chartType, groupBy]);

  return <div ref={chartRef} style={{ width: "600px", height: "400px" }} />;
};

export default Chart;
