import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface HistogramProps {
  volumeData: Uint8Array;
  isoValue: number;
  setIsoValue: (val: number) => void;
  isLogScale?: boolean; 
}

export default function Histogram({ volumeData, isoValue, setIsoValue, isLogScale = false }: HistogramProps) {
  const containerRef = useRef<SVGSVGElement>(null);

  // original D3 code, wrapped in a React effect
  useEffect(() => {
    if (!volumeData || volumeData.length === 0 || !containerRef.current) return;

    const svgElement = d3.select(containerRef.current);
    svgElement.selectAll("*").remove(); 

    // filter out zero-voxels
    const filteredData = volumeData.filter((d: number) => d > 0);

    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 300 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = svgElement
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const histogramData = d3.histogram<number, number>()
        .value(d => d / 255.0) 
        .domain([0, 1])
        .thresholds(d3.range(0, 1, 0.015))(filteredData as any);

    const xScale = d3.scaleLinear().range([0, width]).domain([0, 1]);
    const yScale = isLogScale ? d3.scaleLog() : d3.scaleLinear();
    const yMax = d3.max(histogramData, d => d.length) || 1;
    yScale.range([height, 0]).domain(isLogScale ? [1, yMax] : [0, yMax]);

    svg.selectAll("rect")
        .data(histogramData)
        .enter().append("rect")
        .attr("x", d => xScale(d.x0 || 0))
        .attr("y", d => yScale(d.length || 0))
        .attr("width", d => Math.max(0, xScale(d.x1 || 0) - xScale(d.x0 || 0)))
        .attr("height", d => height - yScale(d.length || 0))
        .attr("fill", "#9395d3");

    const xAxis = d3.axisBottom(xScale);
    svg.append("g").attr("transform", "translate(0, " + height + ")").call(xAxis);

    let isoLine = svg.append("line")
        .attr("id", "isoLine")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("cursor", "pointer")
        .attr("x1", xScale(isoValue))
        .attr("y1", height)
        .attr("x2", xScale(isoValue))
        .attr("y2", 0);

    let isoLineDragArea = svg.append("rect")
        .attr("id", "isoDragArea")
        .attr("x", xScale(isoValue) - 10)
        .attr("y", 0)
        .attr("width", 20)
        .attr("height", height)
        .attr("opacity", 0)
        .attr("cursor", "pointer");

    let dragHandler = d3.drag<SVGRectElement, unknown>()
        .on("start", function() { d3.select(this).raise(); })
        .on("drag", function(event) {
            let x = event.x;
            let newIsoValue = xScale.invert(x);
            newIsoValue = Math.max(0, Math.min(1, newIsoValue)); 
            
            isoLine.attr("x1", xScale(newIsoValue)).attr("x2", xScale(newIsoValue));
            isoLineDragArea.attr("x", xScale(newIsoValue) - 10);
            
            setIsoValue(newIsoValue);
        });

    dragHandler(isoLineDragArea as any);
  }, [volumeData, isLogScale]); 

  // keep histogram and slider in sync
  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current);
    const xScale = d3.scaleLinear().range([0, 300 - 40]).domain([0, 1]); 
    svg.select("#isoLine").attr("x1", xScale(isoValue)).attr("x2", xScale(isoValue));
    svg.select("#isoDragArea").attr("x", xScale(isoValue) - 10);
  }, [isoValue]);

  return (
    <div style={{ marginTop: '10px' }}>
      <svg ref={containerRef} style={{ display: 'block' }}></svg>
    </div>
  );
}