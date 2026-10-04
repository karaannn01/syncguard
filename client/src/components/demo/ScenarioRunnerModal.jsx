import React, { useState } from 'react';
import { 
  X, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Server, 
  Laptop, 
  Layers, 
  Sparkles,
  GitMerge,
  Cpu
} from 'lucide-react';
import { api } from '../../services/api';
import syncManager from '../../services/syncManager';
import db from '../../db/dexieDb';
import { useDevice } from '../../hooks/useDevice';

export function ScenarioRunnerModal({ isOpen, onClose, onNavigateToConflict }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [stepLogs, setStepLogs] = useState([]);
  const [detectedConflictId, setDetectedConflictId] = useState(null);

  const { switchDevice } = useDevice();

  if (!isOpen) return null;

  const logMessage = (msg) => {
    setStepLogs(prev => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
  };

  // Step 1: Reset baseline to Task 7701 at version 7
  const runStep1 = async () => {
    setIsRunning(true);
    logMessage('Step 1: Resetting database to baseline...');
    try {
      await api.resetDemoData();
      await db.outbox.clear();
      await db.conflicts.clear();
      await db.tasks.clear();
      await syncManager.pullServerState();
      logMessage('Baseline established: Task 7701 is at version 7 (status=IN_PROGRESS, quantity=40).');
      setCurrentStep(1);
    } catch (err) {
      logMessage(`Error in Step 1: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 2: Device A offline mutation
  const runStep2 = async () => {
    setIsRunning(true);
    logMessage('Step 2: Activating Device A (dev-alpha-01) offline...');
    try {
      switchDevice('dev-alpha-01');
      // Create Device A outbox operation directly in Dexie
      const opA = {
        operationId: `op-devA-demo-${Date.now()}`,
        deviceId: 'dev-alpha-01',
        userId: 'usr-tech-01',
        entityType: 'task',
        entityId: 'tsk-7701',
        operationType: 'update',
        baseVersion: 7,
        changedFields: ['status', 'quantity'],
        payload: { status: 'COMPLETED', quantity: 50 },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      await db.outbox.put(opA);
      logMessage('Device A offline mutation queued in Outbox: status="COMPLETED", quantity=50, baseVersion=7.');
      setCurrentStep(2);
    } catch (err) {
      logMessage(`Error in Step 2: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 3: Device B offline mutation
  const runStep3 = async () => {
    setIsRunning(true);
    logMessage('Step 3: Activating Device B (dev-beta-02) offline...');
    try {
      switchDevice('dev-beta-02');
      // Create Device B outbox operation
      const opB = {
        operationId: `op-devB-demo-${Date.now()}`,
        deviceId: 'dev-beta-02',
        userId: 'usr-tech-02',
        entityType: 'task',
        entityId: 'tsk-7701',
        operationType: 'update',
        baseVersion: 7,
        changedFields: ['status', 'quantity'],
        payload: { status: 'IN_PROGRESS', quantity: 45 },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        retryCount: 0
      };
      await db.outbox.put(opB);
      logMessage('Device B offline mutation queued in Outbox: status="IN_PROGRESS", quantity=45, baseVersion=7.');
      setCurrentStep(3);
    } catch (err) {
      logMessage(`Error in Step 3: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 4: Device A reconnects and synchronizes
  const runStep4 = async () => {
    setIsRunning(true);
    logMessage('Step 4: Device A reconnects to network and submits outbox batch...');
    try {
      const opA = await db.outbox.where('deviceId').equals('dev-alpha-01').first();
      if (!opA) throw new Error('Device A outbox item missing');

      const res = await api.syncBatch([opA], 'dev-alpha-01');
      logMessage(`Device A synchronized successfully! Server version advanced to v${res.results[0].version}.`);
      await db.outbox.delete(opA.operationId);
      setCurrentStep(4);
    } catch (err) {
      logMessage(`Error in Step 4: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 5: Device B reconnects with stale baseVersion 7 -> CONFLICT DETECTED!
  const runStep5 = async () => {
    setIsRunning(true);
    logMessage('Step 5: Device B reconnects to network and submits outbox with baseVersion 7...');
    try {
      const opB = await db.outbox.where('deviceId').equals('dev-beta-02').first();
      if (!opB) throw new Error('Device B outbox item missing');

      const res = await api.syncBatch([opB], 'dev-beta-02');
      const conflictRes = res.results[0];

      if (conflictRes.status === 'CONFLICT') {
        logMessage(`⚠️ CONFLICT DETECTED by Server Concurrency Engine!`);
        logMessage(`Conflicting fields: ${conflictRes.conflictingFields.join(', ')}`);
        logMessage(`Server (v${conflictRes.serverVersion}) values: ${JSON.stringify(conflictRes.serverValues)}`);
        logMessage(`Device B (base v${conflictRes.baseVersion}) values: ${JSON.stringify(conflictRes.localValues)}`);

        setDetectedConflictId(conflictRes.conflictId);

        // Store conflict locally in Dexie
        await db.conflicts.put({
          id: conflictRes.conflictId,
          operation_id: opB.operationId,
          entity_type: 'task',
          entityId: 'tsk-7701',
          base_version: conflictRes.baseVersion,
          server_version: conflictRes.serverVersion,
          server_values: conflictRes.serverValues,
          local_values: conflictRes.localValues,
          conflicting_fields: conflictRes.conflictingFields,
          status: 'UNRESOLVED',
          created_at: new Date().toISOString()
        });

        await db.outbox.update(opB.operationId, { status: 'CONFLICT', conflictId: conflictRes.conflictId });
        setCurrentStep(5);
      } else {
        logMessage(`Unexpected status: ${conflictRes.status}`);
      }
    } catch (err) {
      logMessage(`Error in Step 5: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Automated 1-Click Run
  const handleAutoRunAll = async () => {
    setStepLogs([]);
    logMessage('Starting 1-Click Automated Conflict Demo...');
    await runStep1();
    await new Promise(r => setTimeout(r, 600));
    await runStep2();
    await new Promise(r => setTimeout(r, 600));
    await runStep3();
    await new Promise(r => setTimeout(r, 600));
    await runStep4();
    await new Promise(r => setTimeout(r, 600));
    await runStep5();
    logMessage('✅ Official Demonstration Scenario complete. Ready for Conflict Center resolution.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Interactive Demo Lab (ALG-WEB-02)
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Task 7701
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official Hackathon Multi-Device Offline Concurrency Demonstration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scenario Roadmap */}
        <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 text-xs space-y-2">
          <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Demonstration Protocol Overview:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <strong className="text-sky-300">Device A (Toughbook):</strong> Starts at v7 → goes offline → status: <span className="text-emerald-400 font-mono">COMPLETED</span>, qty: <span className="text-emerald-400 font-mono">50</span>.
            </div>
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <strong className="text-amber-300">Device B (Tablet):</strong> Starts at v7 → goes offline → status: <span className="text-sky-400 font-mono">IN_PROGRESS</span>, qty: <span className="text-sky-400 font-mono">45</span>.
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Device A reconnects → advances server to v8. Device B reconnects → baseVersion 7 mismatch triggers deterministic conflict detection!
          </p>
        </div>

        {/* Step Progress & Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Step-by-Step Execution
            </span>
            <button
              onClick={handleAutoRunAll}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>1-Click Run Entire Scenario</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
            <button
              onClick={runStep1}
              disabled={isRunning}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                currentStep >= 1 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-850 border-slate-800 text-slate-400'
              }`}
            >
              <div className="font-bold text-[11px]">1. Reset Baseline</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Task 7701 @ v7</div>
            </button>

            <button
              onClick={runStep2}
              disabled={isRunning || currentStep < 1}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                currentStep >= 2 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-850 border-slate-800 text-slate-400 disabled:opacity-50'
              }`}
            >
              <div className="font-bold text-[11px]">2. Dev A Offline</div>
              <div className="text-[10px] text-slate-500 mt-0.5">status=Done, qty=50</div>
            </button>

            <button
              onClick={runStep3}
              disabled={isRunning || currentStep < 2}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                currentStep >= 3 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-850 border-slate-800 text-slate-400 disabled:opacity-50'
              }`}
            >
              <div className="font-bold text-[11px]">3. Dev B Offline</div>
              <div className="text-[10px] text-slate-500 mt-0.5">status=InProg, qty=45</div>
            </button>

            <button
              onClick={runStep4}
              disabled={isRunning || currentStep < 3}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                currentStep >= 4 ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-slate-850 border-slate-800 text-slate-400 disabled:opacity-50'
              }`}
            >
              <div className="font-bold text-[11px]">4. Dev A Syncs</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Server → v8</div>
            </button>

            <button
              onClick={runStep5}
              disabled={isRunning || currentStep < 4}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                currentStep >= 5 ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 font-bold' : 'bg-slate-850 border-slate-800 text-slate-400 disabled:opacity-50'
              }`}
            >
              <div className="font-bold text-[11px]">5. Dev B Syncs</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Conflict Flagged!</div>
            </button>
          </div>
        </div>

        {/* Execution Live Terminal Logs */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Real-Time Synchronization Telemetry
          </label>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] h-36 overflow-y-auto space-y-1 text-slate-300">
            {stepLogs.length === 0 ? (
              <span className="text-slate-600">Click '1-Click Run' or '1. Reset Baseline' to execute...</span>
            ) : (
              stepLogs.map((log, i) => (
                <div key={i} className={log.includes('CONFLICT') ? 'text-rose-400 font-bold' : log.includes('successfully') ? 'text-emerald-400' : ''}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Finish CTA */}
        {currentStep === 5 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Conflict Successfully Simulated & Registered!</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Ready to demonstrate side-by-side comparison and explicit resolution.
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                onNavigateToConflict(detectedConflictId);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/50 shrink-0"
            >
              <span>Open Conflict Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScenarioRunnerModal;
