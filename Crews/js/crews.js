var width = 1200,     // svg width
    height = 675,     // svg height
    dr = 20,         // default point radius
    rCrew = 25,
    rPirates = 16,
    rCaptain = 20,    
    off = 15,    // cluster hull offset
    expand = {}, // expanded clusters
    data, net, force, hullg, hull, linkg, link, nodeg, node, labels,originalData;

var nameToIndex ;

var curve = d3.svg.line()
    .interpolate("basis-closed")
    .tension(.85);

var fill = d3.scale.category20();

function nodeid(n) {
  return n.size ? "_g_"+n.group : n.name + n.img;
}

function linkid(l) {
  var u = nodeid(l.source),
      v = nodeid(l.target);
  return u<v ? u+"|"+v : v+"|"+u;
}

function getGroup(n) { return n.group; }

// functions that return nodes and links until selected saga 
function nodesInSaga(nodes,saga){
  i=0
  nameToIndex = {}
  nodesSaga = [];
  nodes.forEach(node => {
      if(node.saga <= saga){
        nodesSaga.push(node)
        nameToIndex[node.name] = i
        i++
      }
  });
  return nodesSaga;
}

function linkInSaga(links,saga){
  linksSaga = [];
  linksSaga1 = [];
  map = new Map()
  links.forEach(link => {
      if(link.saga <= saga){
        link.source = nameToIndex[link.source]
        link.target =  nameToIndex[link.target]
        map.set( String(link.source) +","+String(link.target),link)
        
        linksSaga.push(link)
      }
      
  });
  map.forEach(value=>{
    linksSaga1.push(value)
  })
  return linksSaga1;
}

function getCrews(data) {
    var crews = []
    for(x of data){
      if(x.img.includes("flag"))
        crews[x.group] = x.name;
    }
    return crews;
  }

// function that computes graph to display
function network(data, prev, index, expand) {
  expand = expand || {};
  var gm = {},    // group map
      nm = {},    // node map
      lm = {},    // link map
      gn = {},    // previous group nodes
      gc = {},    // previous group centroids
      nodes = [], // output nodes
      links = [], // output links
      expandedCrew = [];
  // process previous nodes for reuse or centroid calculation
  if (prev) {
    
    prev.nodes.forEach(function(n) {

      var i = index(n), o;
      if (n.size > 0) {
        gn[i] = n;
        n.size = 0;
      } else {
        o = gc[i] || (gc[i] = {x:0,y:0,count:0});
        o.x += n.x;
        o.y += n.y;
        o.count += 1;
      }
    });
  }
  var crew;
  for (var k=0; k<data.nodes.length; ++k) {
    var n = data.nodes[k],
        i = index(n)
    var l = gm[i] || (gm[i]=gn[i]) || (gm[i]={group:i, size:0, nodes:[], name: n.name});
    
    if (expand[i] && !n.img.includes("flag")) {
      // the node should be directly visible
      nm[n.name] = nodes.length;
      nodes.push(n);
      if (gn[i]) {
        // place new nodes at cluster location (plus jitter)
        n.x = gn[i].x 
        n.y = gn[i].y 
      }
    } else {
      // the node is part of a collapsed cluster
      if (l.size == 0) {
        // if new cluster, add to set and position at centroid of leaf nodes
        nm[i] = nodes.length;
      // the node is an expanse crew node => don't push it to nodes
      if(expand[i] && n.img.includes("flag"))
          expandedCrew.push(n);
      else if(expandedCrew.includes(n) && ! expand[i]) {
          var index = expandedCrew.indexOf(n); 
          if(index > -1) 
            expandedCrew.splice(index,1);
      }
      if(!expandedCrew.includes(n)){
        nodes.push(l);
      }
      }
        if (gc[i]) {
          l.x = gc[i].x / gc[i].count;
          l.y = gc[i].y / gc[i].count;
        }
      } 
      l.nodes.push(n);

    l.size += 1;
    n.group_data = l;
  }

  for (i in gm) { gm[i].link_count = 0; }

  // determine links
  for (k=0; k<data.links.length; ++k) {
        
    var e = data.links[k]
    var u = index(e.source);
    var v = index(e.target);
    if (u != v) {
    gm[u].link_count++;
    gm[v].link_count++;
    }
  
    u = expand[u] ? nm[e.source.name] : nm[u];
    v = expand[v] ? nm[e.target.name] : nm[v];
    var i = (u<v ? u+"|"+v : v+"|"+u),
        l = lm[i] || (lm[i] = {source:u, target:v, size:0, color:e.color});
    l.size += 1;
  }
  for (i in lm) { links.push(lm[i]); }

  return {nodes: nodes, links: links};
}

// function that computes cluster
function convexHulls(nodes, index, offset) {
  var hulls = {};
  var names = {}
  // create point sets
  for (var k=0; k<nodes.length; ++k) {
    var n = nodes[k];
    if (n.size) continue;
    var i = index(n),
        l = hulls[i] || (hulls[i] = []);
    names[i] = crews[n.group]
    l.push([n.x-offset, n.y-offset]);
    l.push([n.x-offset, n.y+offset]);
    l.push([n.x+offset, n.y-offset]);
    l.push([n.x+offset, n.y+offset]);
  }

  // create convex hulls
  var hullset = [];
  for (i in hulls) {
    hullset.push({group: i, path: d3.geom.hull(hulls[i]), name: names[i]});
  }

  return hullset;
}

function drawCluster(d) {
  return curve(d.path); 
}

// --------------------------------------------------------

var body = d3.select("body");
var crews = []
var vis = body.append("svg")
   .attr("width", width)
   .attr("height", height)
   ;

var svg = body.append("svg")
   .attr("width", 330)
   .attr("height", height)
   .style("position", "absolute")
   .style("left", "1210px")


    max = { x: 230, y: 152},
    imgUrl = "./background_saga/MerryGo_background.png";


   vis.append("defs")
    .append("pattern")
    .attr("id", "venus")
    .attr('patternUnits', 'userSpaceOnUse')
    .attr("width", width)
    .attr("height", height)
    .append("image")
    .attr("id","background")
    .attr("xlink:href", imgUrl)
    .attr("width", width)
    .attr("height", height);

    vis.append("rect")
    .attr("x", "0")
    .attr("y", "0")
    .attr("id","background_rect")
    .attr("opacity",0.3)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "url(#venus)");

// legend
var greenLine = svg.append("line")
  .attr("x1", 5)
  .attr("y1", 30)
  .attr("x2", 70)
  .attr("y2", 30)
  .attr("stroke-width", 5)
  .attr("stroke", "#00c400");

var redLine = svg.append("line")
  .attr("x1", 5)
  .attr("y1", 70)
  .attr("x2", 70)
  .attr("y2", 70)
  .attr("stroke-width", 5)
  .attr("stroke", "red");

svg.append("text")
   .attr("y", 33)
   .attr("x", 80)
   .text("Allies")
   .attr("font-size", "18px")

svg.append("text")
   .attr("y", 73)
   .attr("x", 80)
   .text("Enemies")
   .attr("font-size", "18px")

// ---------------------------------------------------------------------

d3.json("data/crews.json", function(json) {
  originalData = json;
  data = JSON.parse(JSON.stringify(originalData))
  saga = 1
  nodi = nodesInSaga(data.nodes,saga)
  linki = linkInSaga(data.links,saga) 
  crews = getCrews(data.nodes)
  data = {"links":linki,"nodes":nodi, "saghe": data.saghe}

// creation of time line with group of buttons   
var buttonMenu = d3.select("body").data(data.saghe);

var i = 0
var top = "150px"
var buttonWidth = 290
var buttonHeight = 48
for(var j = 0; j < data.saghe.length; j++) {
  var buttons = buttonMenu.append("button")
  .text(data.saghe[j].name)
  .attr("text-color","#fff")
  .attr("id", data.saghe[j].num)
  .style("background","url("+data.saghe[j].path+")")
  .style("background-size","cover")
  .style("background-position","center")
  .style("height", buttonHeight + "px")
  .style("width", buttonWidth + "px")
  .style("position", "absolute")
  .style("left", "1217px")           
  .style("top", 120 + j * 50 + "px")
  .on("click", function(){
    expand = []
    updateAllGraph(this.id)
    path = data.saghe[this.id-1].path
    opacity = data.saghe[this.id-1].opacity
    updateBackground(path,opacity)
    })
    .append("image")
    .attr("fill",String(data.saghe[j].path))

}

  for (var i=0; i<data.links.length; ++i) {
    o = data.links[i];
    o.source = data.nodes[o.source];
    o.target = data.nodes[o.target];
  }

  hullg = vis.append("g");
  linkg = vis.append("g");
  nodeg = vis.append("g");
  init();
  
  vis.attr("opacity", 0.2)
    .transition()
    .duration(1000)
    .attr("opacity", 1);

});

var defs = vis.append("defs");

// function that add images to nodes
function functionImage(data, image, flag) {
    var img = image ? image : data.nodes[0].img
    defs.append('pattern')
    .attr("id", img)
    .attr("width", 1)
    .attr("height", 1)
    .append("svg:image")
    .attr("id","image")
    .attr("xlink:href", function() { return img.slice(1) })
    .attr("width", function() {if(flag) return rCaptain * 2; else return image ? rPirates * 2 : rCrew * 2;})
    .attr("height", function() {if(flag) return rCaptain * 2; else return image ? rPirates * 2 : rCrew * 2;})
    
    return "url(#" + img + ")"
}

var hulls = []
var linksColor = new Map()
var nodeCoordinates = new Map()

// functions that select nodes and links on mouseOver
function getNeighbors(node) {
  return link[0].reduce((neighbors, link) => {
    var split = link.id.split("-")
    if (split[1] === node.name) {           
      neighbors.push(split[0])       
    } else if (split[0] === node.name) {      
      neighbors.push(split[1])
    }

    return neighbors
  }, [node.name])
}

function getNodeColor(node, neighbors) {
  if (neighbors.indexOf(node.name)>=0) {
    return 1
  }
  return 0.2
}

function getNodeStroke(node, selectedNode, string) {
  if(string == "stroke")
    return linksColor.get(node.name) ? linksColor.get(node.name) : "black"
  else if(linksColor.get(node.name) != undefined)
    return 4;
  else return 1;
}


function getHullColor(hull) {
  var i = 0;
  for (var h of hulls){
    if(h == parseInt(hull.group))
      i = i+1;
  }
  return i>1 ? 1 : 0 
}

function getLinkColor(node, link) {
  if(isNeighborLink(node, link)){
    hulls.push(link.source.group);
    hulls.push(link.target.group);
  }
  if(isNeighborLink(node, link)){
    var color = link.color;
    if(link.color == "#00c400")
      color = "#00c400";
    else color = "#e30022"
    if(node.name != link.source.name)
      linksColor.set(link.source.name, color);
    if(node.name != link.target.name)
      linksColor.set(link.target.name, color);
  }
  return isNeighborLink(node, link) ? 4 : 0
}

function isNeighborLink(node, link) {
  return link.target.name === node.name || link.source.name === node.name
}

function getLabels(label, neighbors) {
  if (neighbors.indexOf(label.name)>=0) {
    return 1
  }
  return 0
}

function selectNode(selectedNode) {
  const neighbors = getNeighbors(selectedNode)
  node.attr('opacity', node => getNodeColor(node, neighbors))
  link.style('stroke-width', link => getLinkColor(selectedNode,link))
  node.style('stroke', node => getNodeStroke(node, selectedNode, "stroke"))
  node.style('stroke-width', node => getNodeStroke(node, "stroke-width"))
  hull.style("opacity", hull => getHullColor(hull))
  labels.style("opacity", label => getLabels(label, neighbors))
  hulls = []
  linksColor = new Map()  
}

// function that applies strenghts to nodes and links
function init(string) {
  if (force) force.stop();
  net = network(data, net, getGroup, expand);
  var strenght = 3;
  var gravity = 0.1;
  var expanded = 0;
  for(key in expand) {
    if(expand[key] == true)
      expanded++; 
  }
  gravity = gravity + expanded * 0.005
  force = d3.layout.force()
      .nodes(net.nodes)
      .links(net.links)
      .size([width, height])
      .linkDistance(function(l) {
        var n1 = l.source, n2 = l.target;
        distance = 60
        if(n1.flag || n2.flag){
          distance = 50
        }
        return n1.group == n2.group ? distance : 200 
        })
      .linkStrength(function(l) {
        str = 3
        strfuori = 0.00000000001
        var n1 = l.source, n2 = l.target;
        if(n1.flag || n2.flag){
          str = 6
          strfuori = 0.00000000001
        }
        return n1.group == n2.group ? str : strfuori; 
        })
    .gravity(gravity)   
    .charge(-500)   
    .friction(0.6)   
      .start();

 var colors = ['#e6194b', '#bcbd22', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', 
              '#bcf60c', '#7f7f7f', '#008080', '#1f77b4', '#9a6324', '#bcf60c', '#800000', '#228B22', '#808000', 
              '#ff7f0e', '#000075', '#808080', '#000000', '#e6194b', '#c40c46', '#ffe119'];

  hullg.selectAll("path.hull").remove();
  hull = hullg.selectAll("path.hull")
      .data(convexHulls(net.nodes, getGroup, off))
    .enter().append("path")
      .attr("class", "hull")
      .attr("d", drawCluster)
      .style("fill", function(d) {return colors[d.group]; })
      .style("fill-opacity", 10)
      .on("click", function(d) {
      
      expand[d.group] = false; 
      init();
    });

    hull.append("title")
      .text(function(d) {return d.name})

  // links' creation
  link = linkg.selectAll("line.link").data(net.links, linkid);
  link.exit().remove();
  link.enter().append("line")
      .attr("class", "link")
      .attr("id", function(d) { return d.source.name + "-" + d.target.name})
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; })
      .style("stroke-width", function(d) { return d.size || 1; })
      .style("stroke", function(d) {return d.color;})
      .style("stroke-opacity", 3);


  // nodes' creation
  node = nodeg.selectAll("circle.node").data(net.nodes, nodeid);
  node.exit().remove();
  node.enter().append("circle")
      // if (d.size) -- d.size > 0 when d is a group node.
      .attr("class", function(d) { return "node" + (d.size?"":" leaf"); })
      .attr("r", function(d) {if(d.flag) return rCaptain; else return d.img ? rPirates : rCrew; }) 
      .attr("id", function(d) { if(d.nodes != undefined && d.nodes[0].img.includes("flag")) 
                               return "crew" + d.group; else return d.name; })
      .attr("cx", function(d) { return d.x; })                            
      .attr("cy", function(d) { return d.y; })
      .style("fill", function(d) {return functionImage(d, d.img, d.flag); })
      .style("stroke", "black")
      .on("click", function(d) {
        link.style("stroke-width", function(d) { return d.size || 1; })
        expand[d.group] = !expand[d.group];
        d3.selectAll("#label").remove()
        init();
        node.style('stroke', "black")
        node.style('stroke-width', 1)
        node.attr('opacity', 1)
        if(expand[d.group] == true)
          d3.selectAll("#crew" + d.group).remove(); 
      });
      
  var title = node.append("title")
    .text(function(d) {return d.name})

  node.on("mouseover",function() {
        
        createLabels() 
        nodeSelected = d3.select(this)
        selectNode(nodeSelected.data()[0])
      })
      .on('mouseout',function() {
        d3.selectAll("#label").remove()
        node.attr('opacity', 1)
        node.style("stroke", "black")
        node.style("stroke-width", 1)
        link.style("stroke-width", function(d) { return d.size || 1; })
        hull.style("opacity", 1)
        //labels.style("opacity", 0)
      })

  // nodes' label
  function createLabels(){
    console.log("aaa")
    labels = vis.append("g").selectAll("circle")
    .data(net.nodes)
    .enter().append("svg:text")
    .style("cursor", "none")
    .style("pointer-events","none")
    .style("fill","black")
    .text(function(d) { return d.name})
    .attr("id", "label")
    .style("text-anchor", "middle")
    .style("fill", "white")
    .style("stroke","black")
    .style("stroke-width", 0.8)
    .style("font-family", "Arial")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .attr("opacity", 1) 
    .attr("transform", "translate(0,-30)")
    ;

    labels.attr("x", function(d) { return d.x = Math.max(rCrew, Math.min(width - rCrew, d.x)); })
          .attr("y", function(d) { return d.y = Math.max(rCrew, Math.min(height - rCrew, d.y)); });
  }
  createLabels()
  labels.remove()
  node.call(force.drag);

  force.on("tick", function() {


    var q = d3.geom.quadtree(net.nodes),
      i = 0,
      n = net.nodes.length;

    while (++i < n) q.visit(collide(net.nodes[i]));

    if (!hull.empty()) {
      hull.data(convexHulls(net.nodes, getGroup, off))
          .attr("d", drawCluster);
    }

    link.attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
    if(labels)
      labels.attr("x", function(d) { return d.x = Math.max(rCrew, Math.min(width - rCrew, d.x)); })
          .attr("y", function(d) { return d.y = Math.max(rCrew, Math.min(height - rCrew, d.y)); });

    node.attr("cx", function(d) { return d.x = Math.max(rCrew, Math.min(width - rCrew , d.x)); })
        .attr("cy", function(d) { return d.y = Math.max(rCrew, Math.min(height - rCrew , d.y)); });
    
    
  })
}

function collide(node) {  
  var r = node.img ? rPirates * 2 : rCrew * 2 ;
  if(node.name && node.flag){
    r = rPirates * 2  
  }
  var nx1 = node.x - r,
      nx2 = node.x + r,
      ny1 = node.y - r,
      ny2 = node.y + r;

  
  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point != node)) {
      if(quad.point.group != node.group){
      var x = node.x - quad.point.x,
          y = node.y - quad.point.y,
          l = Math.sqrt(x * x + y * y);
       
      if (l < r) {
        l = (l - r) / l * .5;
        node.x -= x *= l;
        node.y -= y *= l;
        quad.point.x += x;
        quad.point.y += y;
      }
    }
    else {
      //r = rPirates * 2
      var x = node.x - quad.point.x,
          y = node.y - quad.point.y,
          l = Math.sqrt(x * x + y * y);
       
      if (l < r) {
        l = (l - r) / l * .5;
        node.x -= x *= l;
        node.y -= y *= l;
        quad.point.x += x;
        quad.point.y += y;
    }
  }

    return x1 > nx2
        || x2 < nx1
        || y1 > ny2
        || y2 < ny1;
  }
  };
}

// update graph on selected saga
function updateAllGraph(saga){

  data = JSON.parse(JSON.stringify(originalData))
  nodesToUpdate = nodesInSaga(data.nodes,saga)
  linksToUpdate = linkInSaga(data.links,saga)
  crews = getCrews(data.nodes)

  data = {"links":linksToUpdate,"nodes":nodesToUpdate, "saghe": originalData.saghe}

  for (var i=0; i<data.links.length; ++i) {
    o = data.links[i];
    o.source = data.nodes[o.source];
    o.target = data.nodes[o.target];
  }

  init("saga");
}

function updateBackground(url,opacity){
    
  d3.select("#background").attr("xlink:href", url)
  d3.select("#background_rect").attr("opacity",opacity)
  
}