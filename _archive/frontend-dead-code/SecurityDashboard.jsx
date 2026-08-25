import { motion } from "framer-motion";

export default function SecurityDashboard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        width: "90%",
        maxWidth: "1100px",
        marginTop: "100px",
        padding: "40px",
        borderRadius: "25px",
        background: "rgba(15,23,42,0.75)",
        border: "1px solid rgba(59,130,246,0.25)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 40px rgba(37,99,235,0.2)",
        textAlign: "left",
      }}
    >

      <h2
        style={{
          fontSize:"32px",
          marginBottom:"30px",
        }}
      >
        🛡 Security Command Center
      </h2>


      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
          gap:"20px",
        }}
      >

        <Card
          title="Security Score"
          value="94%"
          color="#22C55E"
        />

        <Card
          title="Critical Threats"
          value="02"
          color="#EF4444"
        />

        <Card
          title="Protected Assets"
          value="128"
          color="#3B82F6"
        />

        <Card
          title="AI Status"
          value="ACTIVE"
          color="#06B6D4"
        />

      </div>


      <div
        style={{
          marginTop:"35px",
          padding:"25px",
          borderRadius:"18px",
          background:"#020617",
        }}
      >

        <p
          style={{
            color:"#94A3B8"
          }}
        >
          🤖 Sentinel AI Engine
        </p>


        <h3
          style={{
            color:"#22C55E"
          }}
        >
          ● Monitoring threats in real-time
        </h3>


        <div
          style={{
            height:"8px",
            background:"#1E293B",
            borderRadius:"20px",
            marginTop:"20px",
          }}
        >
          <div
            style={{
              width:"94%",
              height:"100%",
              background:"#2563EB",
              borderRadius:"20px",
            }}
          />
        </div>

      </div>


    </motion.section>
  );
}



function Card({title,value,color}) {

  return (
    <div
      style={{
        padding:"25px",
        borderRadius:"18px",
        background:"#020617",
        border:"1px solid rgba(255,255,255,.08)",
      }}
    >

      <p
        style={{
          color:"#94A3B8",
          margin:0,
        }}
      >
        {title}
      </p>


      <h1
        style={{
          color,
          marginTop:"15px",
        }}
      >
        {value}
      </h1>

    </div>
  );
}
