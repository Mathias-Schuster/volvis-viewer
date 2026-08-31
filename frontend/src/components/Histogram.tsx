import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ControlPoint } from '../App';

interface HistogramProps {
  volumeData: Uint8Array;
  isoValue: number;
  setIsoValue: (val: number) => void;
  isLogScale?: boolean;
  controlPoints: ControlPoint[];
  setControlPoints: (points: ControlPoint[]) => void;
  compositeMode: number;
}

export default function Histogram({ 
  volumeData, 
  isoValue, 
  setIsoValue, 
  isLogScale = false, 
  controlPoints, 
  setControlPoints,
  compositeMode
}: HistogramProps) {
  const containerRef = useRef<SVGSVGElement>(null);

  // Draw static histogram (only when volumeData or isLogScale changes)
  useEffect(() => {
    if (!volumeData || volumeData.length === 0 || !containerRef.current) return;

    const svgElement = d3.select(containerRef.current);
    svgElement.selectAll("*").remove(); 

    // filter out zero-voxels
    const filteredData = volumeData.filter((d: number) => d > 0);

    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 300 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    const svg = svgElement
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
        .attr("id", "main-group");

    const histogramData = d3.histogram<number, number>()
        .value(d => d / 255.0) 
        .domain([0, 1])
        .thresholds(d3.range(0, 1, 0.015))(filteredData as any);

    const xScale = d3.scaleLinear().range([0, width]).domain([0, 1]);
    const yScale = isLogScale ? d3.scaleLog() : d3.scaleLinear();
    const yMax = d3.max(histogramData, d => d.length) || 1;
    yScale.range([height, 0]).domain(isLogScale ? [1, yMax] : [0, yMax]);

    svg.append("g").attr("id", "bins-group")
        .selectAll("rect")
        .data(histogramData)
        .enter().append("rect")
        .attr("x", d => xScale(d.x0 || 0))
        .attr("y", d => yScale(d.length || 0))
        .attr("width", d => Math.max(0, xScale(d.x1 || 0) - xScale(d.x0 || 0)))
        .attr("height", d => height - yScale(d.length || 0))
        .attr("fill", "#9395d3");

    const xAxis = d3.axisBottom(xScale);
    svg.append("g").attr("transform", "translate(0, " + height + ")").call(xAxis);

    // empty layers for iso line and transfer function
    svg.append("g").attr("id", "iso-group");
    svg.append("g").attr("id", "tf-group");
  }, [volumeData, isLogScale]); 


  // Draw dynamic ISO line and transfer function
  useEffect(() => {
    if (!containerRef.current) return;

    const svg = d3.select(containerRef.current).select("#main-group");
    if (svg.empty() || !controlPoints) return;

    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 300 - margin.left - margin.right;
    const height = 150 - margin.top - margin.bottom;

    const xScale = d3.scaleLinear().range([0, width]).domain([0, 1]); // density
    const yAlphaScale = d3.scaleLinear().range([height, 0]).domain([0, 1]);

    // clear lines and points
    const isoGroup = svg.select("#iso-group");
    const tfGroup = svg.select("#tf-group");
    isoGroup.selectAll("*").remove();
    tfGroup.selectAll("*").remove();
    
    if (compositeMode === 1) {
      isoGroup.append("line")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("x1", xScale(isoValue))
        .attr("y1", height)
        .attr("x2", xScale(isoValue))
        .attr("y2", 0);

      const dragIsoHandler = d3.drag<SVGLineElement, unknown>()
        .on("start", function() { d3.select(this).raise(); })
        .on("drag", function(event) {
          let x = event.x;
          let newIsoValue = xScale.invert(x);
          newIsoValue = Math.max(0, Math.min(1, newIsoValue));
          setIsoValue(newIsoValue);
        });

      isoGroup.append("rect")
        .attr("x", xScale(isoValue) - 10)
        .attr("y", 0)
        .attr("width", 20)
        .attr("height", height)
        .attr("opacity", 0)
        .attr("cursor", "ew-resize")
        .call(dragIsoHandler as any);
    }

    if (compositeMode === 2) {
      const lineGenerator = d3.line<ControlPoint>()
        .x(d => xScale(d.x))
        .y(d => yAlphaScale(d.alpha));
      
      tfGroup.append("path")
        .datum(controlPoints)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("d", lineGenerator as any);
      
      const dragTFHandler = d3.drag<SVGCircleElement, ControlPoint>()
        .subject(function(event, d) {
          return { x: xScale(d.x), y: yAlphaScale(d.alpha) };
        })
        .on("drag", function(event, d) {
          const index = controlPoints?.indexOf(d);
          if (index === -1) return;
          
          let newX = xScale.invert(event.x);
          let newAlpha = yAlphaScale.invert(event.y);

          const minX = index > 0 ? controlPoints[index - 1].x : 0;
          const maxX = index < controlPoints.length - 1 ? controlPoints[index + 1].x : 1;
          
          newX = Math.max(minX, Math.min(maxX, newX));
          newAlpha = Math.max(0, Math.min(1, newAlpha));

          const newPoints = [...controlPoints];
          newPoints[index] = { ...newPoints[index], x: newX, alpha: newAlpha };
          newPoints.sort((a, b) => a.x - b.x);
          
          setControlPoints(newPoints);
        });

      tfGroup.selectAll("circle")
        .data(controlPoints)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yAlphaScale(d.alpha))
        .attr("r", 6)
        .attr("fill", d => d.color)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("cursor", "move")
        .call(dragTFHandler as any);
    }
  }, [isoValue, controlPoints, setIsoValue, setControlPoints, compositeMode]);

  return (
    <div style={{ marginTop: '10px' }}>
      <svg ref={containerRef} style={{ display: 'block' }}></svg>
    </div>
  );
}