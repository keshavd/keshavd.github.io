import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars, Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type MemoryGraph = {
  person: {
    id: string;
    name: string;
    headline: string;
    current_focus: string[];
  };
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary: string;
    tags: string[];
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    summary: string;
  }>;
  memories: Array<{
    id: string;
    title: string;
    text: string;
    entities: string[];
    tags: string[];
  }>;
};

type BrainNode = {
  id: string;
  label: string;
  kind: "person" | "entity" | "memory";
  position: [number, number, number];
  color: string;
  size: number;
};

type BrainEdge = {
  id: string;
  source: string;
  target: string;
  color: string;
};

const ENTITY_COLORS: Record<string, string> = {
  company: "#6ddf95",
  institution: "#a8d8ff",
  experience: "#93b7ff",
  expertise: "#ffc8e0",
  project: "#ffd699",
  interest: "#c9bfff",
  value: "#ff9d7b",
  dog: "#f4d35e"
};

function buildBrainGraph(graph: MemoryGraph) {
  const nodes: BrainNode[] = [
    {
      id: graph.person.id,
      label: graph.person.name,
      kind: "person",
      position: [0, 0, 0],
      color: "#ffffff",
      size: 0.28
    }
  ];
  const edges: BrainEdge[] = [];
  const entityAngles = graph.entities.map(
    (_, index) => (index / graph.entities.length) * Math.PI * 2
  );

  graph.entities.forEach((entity, index) => {
    const angle = entityAngles[index];
    const radius = 2.1;
    const position: [number, number, number] = [
      Math.cos(angle) * radius,
      Math.sin(index * 1.7) * 0.55,
      Math.sin(angle) * radius
    ];

    const isBeauty = entity.id === "beauty";
    const size = isBeauty ? 1.8 : 0.18;

    nodes.push({
      id: entity.id,
      label: entity.name,
      kind: "entity",
      position,
      color: ENTITY_COLORS[entity.type] || "#9be7ff",
      size
    });
  });

  graph.relationships.forEach((relationship) => {
    edges.push({
      id: `${relationship.source}-${relationship.type}-${relationship.target}`,
      source: relationship.source,
      target: relationship.target,
      color: "#8fbf9f"
    });
  });

  graph.memories.forEach((memory, index) => {
    const anchors = memory.entities
      .map((entityId) => nodes.find((node) => node.id === entityId))
      .filter(Boolean) as BrainNode[];
    const average = anchors.length
      ? anchors.reduce<[number, number, number]>(
          (total, node) => [
            total[0] + node.position[0] / anchors.length,
            total[1] + node.position[1] / anchors.length,
            total[2] + node.position[2] / anchors.length
          ],
          [0, 0, 0]
        )
      : ([0, 0, 0] as [number, number, number]);
    const offsetAngle = index * 1.618;
    const memoryPosition: [number, number, number] = [
      average[0] + Math.cos(offsetAngle) * 0.7,
      average[1] + 0.65 + (index % 2) * 0.28,
      average[2] + Math.sin(offsetAngle) * 0.7
    ];

    nodes.push({
      id: memory.id,
      label: memory.title,
      kind: "memory",
      position: memoryPosition,
      color: "#d7ffe3",
      size: 0.1
    });

    memory.entities.forEach((entityId) => {
      edges.push({
        id: `${memory.id}-${entityId}`,
        source: memory.id,
        target: entityId,
        color: "#d7ffe3"
      });
    });
  });

  return { nodes, edges };
}

function BrainNodeMesh({ node }: { node: BrainNode }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }

    const pulse = Math.sin(clock.elapsedTime * 1.8 + node.position[0]) * 0.08;
    meshRef.current.scale.setScalar(1 + pulse);
  });

  return (
    <group position={node.position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[node.size, 32, 32]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={node.kind === "person" ? 1.7 : 1.1}
          roughness={0.18}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[node.size * 1.9, 32, 32]} />
        <meshBasicMaterial
          color={node.color}
          transparent
          opacity={node.kind === "person" ? 0.16 : 0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Text
        color="#f7fff8"
        fontSize={node.kind === "person" ? 0.16 : 0.115}
        maxWidth={1.5}
        outlineColor="#111111"
        outlineWidth={0.01}
        position={[0, -node.size - 0.2, 0]}
        textAlign="center"
      >
        {node.label}
      </Text>
    </group>
  );
}

function BrainScene({ graph }: { graph: MemoryGraph }) {
  const { nodes, edges } = useMemo(() => buildBrainGraph(graph), [graph]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  return (
    <>
      <color attach="background" args={["#07130d"]} />
      <fog attach="fog" args={["#07130d", 4, 9]} />
      <ambientLight intensity={0.35} />
      <pointLight color="#b9ffce" intensity={14} position={[0, 2, 3]} />
      <Stars
        count={700}
        depth={12}
        factor={0.65}
        fade
        radius={7}
        saturation={0}
        speed={0.25}
      />

      {edges.map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        if (!source || !target) {
          return null;
        }

        return (
          <Line
            color={edge.color}
            key={edge.id}
            lineWidth={1.2}
            opacity={0.45}
            points={[source.position, target.position]}
            transparent
          />
        );
      })}

      {nodes.map((node) => (
        <BrainNodeMesh key={node.id} node={node} />
      ))}

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.45}
        enableDamping
        maxDistance={7}
        minDistance={2.6}
      />
    </>
  );
}

export default function MemoryGraphBrain() {
  const [graph, setGraph] = useState<MemoryGraph | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/data/keshav-kb.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Could not load memory graph.");
        }

        return response.json() as Promise<MemoryGraph>;
      })
      .then(setGraph)
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load memory graph."
        );
      });
  }, []);

  return (
    <section className="brain-canvas-shell" aria-label="Memory graph brain">
      {error ? <div className="brain-loading">{error}</div> : null}
      {!graph && !error ? (
        <div className="brain-loading">Loading memory graph...</div>
      ) : null}
      {graph ? (
        <Canvas camera={{ position: [0, 2.2, 5.2], fov: 48 }}>
          <BrainScene graph={graph} />
          <Html center position={[0, -2.35, 0]}>
            <div className="brain-hint">Drag to orbit. Scroll to zoom.</div>
          </Html>
        </Canvas>
      ) : null}
    </section>
  );
}
